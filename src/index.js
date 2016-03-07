import Popup from 'native/popup';
import Crypto from 'native/crypto';

import Store from 'showtime/store';
import {request} from 'showtime/http';
import Service from 'showtime/service';
import Settings from 'showtime/settings';
import Page, {Route} from 'showtime/page';

const plugin = JSON.parse(Plugin.manifest);

const {
	id,
	icon,
	i18n,
	title,
	category,
	synopsis,
} = plugin;

const iconPath = Plugin.path + icon;
const storage = Storage(id);

const USER_AGENT = 'xbmc for soap';

function headers() {
	return {
		'User-Agent': USER_AGENT,
		'X-Api-Token': getToken(),
		'Accept-Encoding': 'gzip, deflate',
	};
}

const routes = {
	START: prefix('start'),
	SERIES: prefix('browse', '([0-9]+)'),
	SEASON: prefix('browse', '([0-9]+)', 'season', '([0-9]+)'),
	EPISODE: prefix('browse', '([0-9]+)', 'season', '([0-9]+)', 'video', '([0-9]+)'),
	LOGIN: prefix('login'),
	LOGOUT: prefix('logout'),
};

const urls = {
	login: 'https://soap4.me/login/',
	series: {
		all: 'https://soap4.me/api/soap/',
		my: 'https://soap4.me/api/soap/my/',
		video: 'https://soap4.me/callback/',
		episodes: 'https://soap4.me/api/episodes/',
	},
	covers: {
		serie: 'https://covers.soap4.me/soap/',
		season: 'https://covers.soap4.me/season/',
	}
};

const cache = {};
const dataHandlers = {
	series: {
		load() {
			let response = request(urls.series.my, {
				method: 'GET',
				noFollow: true,
				headers: headers(),
			});

			let data = JSON.parse(response);

			return cache.series = data.reduce((result, item) => {
				result[item.sid] = item;
				return result;
			}, {raw: data});
		}
	},
	seasons: {
		get(sid) {
			return cache[sid];
		},

		load(sid) {
			let response = request(urls.series.episodes + sid, {
				method: 'GET',
				noFollow: true,
				headers: headers(),
			});

			let data = JSON.parse(response);

			return cache[sid] = data.reduce((result, item) => {
				let seasonIndex = item.season - 1;
				let episodeIndex = item.episode - 1;

				if (!result.seasons[seasonIndex]) {
					result.seasons[seasonIndex] = {
						id: item.season_id,
						season: item.season,
						episodes: [],
					};
				}

				if (!result.seasons[seasonIndex].episodes[episodeIndex]) {
					result.seasons[seasonIndex].episodes[episodeIndex] = {};
				}
				result.seasons[seasonIndex].episodes[episodeIndex][item.quality] = item;
				return result;
			}, {seasons: [], raw: data});
		}
	},
};

function getData(name, ...args) {
	let {get, load} = dataHandlers[name];
	let cachedValue = typeof(get) === 'function' ? get(...args) : cache[name];

	if (cachedValue) return cachedValue;
	return load(...args);
}

const handlers = {
	[routes.START](page) {
		page.loading = true;

		if (getToken()) {
			page.metadata.title = title;
			page.metadata.logo = iconPath;
			page.model.contents = 'grid';
			page.contents = 'items';
			page.type = 'directory';

			let {raw: data} = getData('series');

			let ongoing = data.filter(({status, unwatched}) => status == 0 || unwatched > 0);
			let unwatched = ongoing.filter(({unwatched}) => unwatched > 0);
			let watched = ongoing.filter(({unwatched}) => !unwatched);
			let closed = data.filter(({status, unwatched}) => status > 0 && !unwatched);

			renderSectionGrid(page, unwatched, i18n.SectionUnwatched);
			renderSectionGrid(page, watched, i18n.SectionWatched);
			renderSectionGrid(page, closed, i18n.SectionClosed);

			page.loading = false;
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.SERIES](page, sid) {
		if (getToken()) {
			page.loading = true;

			let series = getData('series');
			let serie = series[sid];

			page.metadata.title = serie.title;
			page.metadata.logo = `${urls.covers.serie}${sid}.jpg`;
			page.model.contents = 'grid';
			page.contents = 'items';
			page.type = 'directory';

			let {seasons} = getData('seasons', sid);

			seasons.forEach(({id: seasonId}, i) => page.appendItem(prefix('browse', sid, 'season', seasonId), 'video', {
				title: `${i18n.SeasonTitle} ${i + 1}`,
				icon: `${urls.covers.season}big/${seasonId}.jpg`,
			}))

			page.loading = false;
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.SEASON](page, sid, seasonId) {
		page.loading = true;

		if (getToken()) {
			let series = getData('series');
			let {seasons} = getData('seasons', sid);
			let [season] = seasons.filter(({id}) => id == seasonId);
			let serie = series[sid];

			page.metadata.title = `${serie.title} — ${i18n.SeasonTitle} ${season.season}`;
			page.metadata.logo = `${urls.covers.season}${seasonId}.jpg`;
			page.contents = 'items';
			page.type = 'directory';

			season.episodes.forEach(({'720p': episode}) => {
				page.appendItem(prefix('browse', sid, 'season', seasonId, 'video', episode.eid), 'video', {
					title: getEpisodeTitle(episode),
					icon: `${urls.covers.season}big/${seasonId}.jpg`,
					description: episode.spoiler,
				});
			});

			page.loading = false;
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.EPISODE](page, sid, seasonId, eid) {
		page.loading = true;

		let token = getToken();

		if (token) {
			let {seasons} = getData('seasons', sid);
			let [season] = seasons.filter(({id}) => id == seasonId);
			let [episode] = season.episodes
				.map(({'720p': episode}) => episode)
				.filter((episode) => episode.eid == eid);

			let hash = md5(token + eid + sid + episode.hash);

			let response = request(urls.series.video, {
				method: 'POST',
				noFollow: true,
				headers: headers(),
				postdata: {
					eid,
					hash,
					token,
					do: 'load',
					what: 'player',
				},
			});

			if (response.statuscode !== 200) {
				return page.error(i18n.ErrorUnknown);
			}

			let {ok, server, subs, comment} = JSON.parse(response);

			if (!ok) {
				return page.error(i18n.ErrorRetrieveVideoLink);
			}

			let url = `https://${server}.soap4.me/${token}/${eid}/${hash}/`;
			let video = {
				title: getEpisodeTitle(episode),
				canonicalUrl: prefix('browse', sid, 'season', seasonId, 'video', eid),
				sources: [{url}],
			};

			page.loading = false;
			page.source = `videoparams:${JSON.stringify(video)}`;
			page.type = 'video';
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.LOGIN](page) {
		let {
			username: login,
			password,
			rejected,
		} = Popup.getAuthCredentials(title, i18n.LoginRequired, true);

		if (rejected) {
			return page.redirect(routes.LOGIN2);
		}

		let response = request(urls.login, {
			method: 'POST',
			noFollow: true,
			headers: headers(),
			postdata: {login, password},
		});

		if (response.statuscode !== 200) {
			notify(i18n.LoginError);
			return page.redirect(routes.LOGIN);
		}

		let {ok, token, till} = JSON.parse(response);

		if (!ok) {
			notify(i18n.LoginIncorrect);
			return page.redirect(routes.LOGIN);
		}

		setToken(token, till);
		page.redirect(routes.START);
	},

	[routes.LOGOUT](page) {
		deleteToken();
		page.redirect(routes.START);
	},
};

const service = Service.create(title, routes.START, category, true, iconPath);

Settings.globalSettings(id, title, iconPath, synopsis);
Settings.createDivider('General');
Settings.createAction(routes.LOGOUT, 'Logout', handlers[routes.LOGOUT]);

[
	routes.START,
	routes.SERIES,
	routes.SEASON,
	routes.EPISODE,
	routes.LOGIN,
	routes.LOGOUT,
].forEach((route) => new Route(route, handlers[route]));

function renderSectionGrid(page, data, title = '') {
	return {
		title: page.appendItem('', 'separator', {title}),
		items: data.map(({
			sid,
			title,
		}) => page.appendItem(prefix('browse', sid), 'video', {
			title,
			icon: `${urls.covers.serie}big/${sid}.jpg`,
		}))
	};
}

function prefix(...args) {
	return `${plugin.prefix}:${args.join(':')}`;
}

function notify(message, timeout = 5) {
	return Popup.notify(`${plugin.prefix}: ${message}`, timeout);
}

function setToken(token, expires) {
	storage.set('token', token);
	storage.set('token-expires', (`${expires}000`).slice(0, 13));
}

function getToken() {
	let token = storage.get('token');
	let expires = storage.get('token-expires');

	if (Date.now() < expires) {
		return token;
	}

	deleteToken();
	return null;
}

function deleteToken() {
	storage.remove('token');
	storage.remove('token-expires');
}

function dump(data, title) {
	console.log(`${title != null ? `${title}: ` : ''}${JSON.stringify(data)}`);
}

function prettifyNumber(num) {
	return `00${num || ''}`.slice(-2);
}

function getEpisodeTitle(episode) {
	let index = `S${prettifyNumber(episode.season)}E${prettifyNumber(episode.episode)}`;
	let sections = [index, episode.translate, episode.title_en];
	let prefix = '';

	if (!episode.watched) {
		prefix = i18n.EpisodeNewPrefix;
	}

	return prefix + sections.join(' | ');
}

function md5(str = '') {
	let hash = Crypto.hashCreate('md5');
	Crypto.hashUpdate(hash, str);
	let digest = Crypto.hashFinalize(hash);
	return Duktape.enc('hex', digest);
}

function Storage(id) {
	let storage = Store.create(id);

	return {
		get(name) {
			let value = storage[name];
			console.log(`Storage(${id}): Retrieved "${value}" for "${name}"`);
			return value != null ? value : null;
		},

		set(name, value) {
			console.log(`Storage(${id}): Setting "${value}" to "${name}"`);
			try {
				storage[name] = value;
			} catch(error) {}
		},

		remove(name) {
			this.set(name, null);
		}
	};
}
