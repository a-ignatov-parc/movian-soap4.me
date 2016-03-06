import Popup from 'native/popup';

import Store from 'showtime/store';
import {request} from 'showtime/http';
import Service from 'showtime/service';
import Settings from 'showtime/settings';
import Page, {Route} from 'showtime/page';

let plugin = JSON.parse(Plugin.manifest);

let {
	id,
	icon,
	i18n,
	title,
	category,
	synopsis,
} = plugin;

let iconPath = Plugin.path + icon;
let storage = Storage(id);

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
	SHOWS_NEW: prefix('browse', 'new'),
	SHOWS_WATCHING: prefix('browse', 'watching'),
	SHOWS_ALL: prefix('browse', 'all'),
	LOGIN: prefix('login'),
	LOGOUT: prefix('logout'),
};

const url = {
	login: 'https://soap4.me/login/',
	all: 'https://soap4.me/api/soap/',
	watching: 'https://soap4.me/api/soap/my/',
};

const handlers = {
	[routes.START](page) {
		let token = getToken();

		page.metadata.title = title;
		page.metadata.logo = iconPath;
		page.type = 'directory';

		if (token) {
			page.appendItem(prefix('browse', 'new'), 'directory', {
				title: i18n.SectionNew
			});
			page.appendItem(prefix('browse', 'watching'), 'directory', {
				title: i18n.SectionWatching
			});
			page.appendItem(prefix('browse', 'all'), 'directory', {
				title: i18n.SectionAll
			});
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.SHOWS_NEW](page) {
		let token = getToken();

		page.metadata.title = i18n.SectionNew;
		page.metadata.logo = iconPath;
		page.contents = 'items';
		page.type = 'directory';
		page.loading = true;

		if (token) {
			// let response = request(url.watching, {
			// 	method: 'GET',
			// 	noFollow: true,
			// 	headers: headers(),
			// });

			// console.log(response);

			// page.loading = false;
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.SHOWS_WATCHING](page) {
		let token = getToken();

		page.metadata.title = i18n.SectionWatching;
		page.metadata.logo = iconPath;
		page.model.contents = 'grid';
		page.contents = 'items';
		page.type = 'directory';
		page.loading = true;

		if (token) {
			let response = request(url.watching, {
				method: 'GET',
				noFollow: true,
				headers: headers(),
			});
			let data = JSON.parse(response);

			data.forEach(({
				sid,
				year,
				title,
				title_ru,
				description,
				imdb_rating,
			}) => {
				page.appendItem(prefix('browse', sid), 'video', {
					year,
					title,
					description,
					rating: parseFloat(imdb_rating),
					icon: `https://covers.soap4.me/soap/big/${sid}.jpg`,
				});
			});

			page.loading = false;
		} else {
			page.redirect(routes.LOGIN);
		}
	},

	[routes.SHOWS_ALL](page) {
		let token = getToken();

		page.metadata.title = i18n.SectionAll;
		page.metadata.logo = iconPath;
		page.type = 'directory';
		page.loading = true;

		if (token) {
			let response = request(url.all, {
				method: 'GET',
				noFollow: true,
				headers: headers(),
			});

			console.log(response);

			// page.loading = false;
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

		let response = request(url.login, {
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
		console.log('Logout!');
	},
};

const service = Service.create(title, routes.START, category, true, iconPath);

Settings.globalSettings(id, title, iconPath, synopsis);
Settings.createDivider('General');
Settings.createAction(routes.LOGOUT, 'Logout', handlers[routes.LOGOUT]);

new Route(routes.START, handlers[routes.START]);

new Route(routes.SHOWS_WATCHING, handlers[routes.SHOWS_WATCHING]);
new Route(routes.SHOWS_NEW, handlers[routes.SHOWS_NEW]);
new Route(routes.SHOWS_ALL, handlers[routes.SHOWS_ALL]);

new Route(routes.LOGIN, handlers[routes.LOGIN]);
new Route(routes.LOGOUT, handlers[routes.LOGOUT]);

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

	storage.remove('token');
	storage.remove('token-expires');
	return null;
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

function dump(data) {
	console.log(JSON.stringify(data));
}
