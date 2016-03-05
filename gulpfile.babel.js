import gulp from 'gulp';
import assign from 'lodash/extend';
import source from 'vinyl-source-stream';

import config, {movian} from './package.json';

const ASSETS = './assets';
const SOURCE = './src';
const DEST = './out';

const pluginFileName = 'index.js';

const predefinedProps = {
	file: pluginFileName
};

gulp.task('plugin', () => {
	return gulp
		.src(`${SOURCE}/**/*.js`)
		.pipe(gulp.dest(DEST));
});

gulp.task('assets', () => {
	return gulp
		.src(`${ASSETS}/**/*.{png,jpg,gif}`)
		.pipe(gulp.dest(DEST));
});

gulp.task('config', () => {
	let stream = source('plugin.json');
	let configProps = Object
		.keys(movian)
		.filter((name) => movian[name] === null)
		.reduce((result, name) => {
			result[name] = predefinedProps[name] || config[name];
			return result;
		}, {});

	stream.end(JSON.stringify(assign({}, movian, configProps)));

	return stream.pipe(gulp.dest(DEST));
});

gulp.task('default', ['plugin', 'assets', 'config']);
