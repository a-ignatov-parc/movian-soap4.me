import gulp from 'gulp';
import babel from 'gulp-babel';
import rename from 'gulp-rename';
import plumber from 'gulp-plumber';

import through from 'through2';
import assign from 'lodash/extend';

const ASSETS = './assets';
const SOURCE = './src';
const DEST = './out';

const resources = {
	plugin: 'index.js',
	config: 'plugin.json',
	module: './package.json',
	source: `${SOURCE}/**/*.js`,
	assets: `${ASSETS}/**/*.{png,jpg,gif,view}`,
};

gulp.task('plugin', () => {
	return gulp
		.src(resources.source)
		.pipe(plumber())
		.pipe(babel({
			presets: ['es2015']
		}))
		.pipe(rename(resources.plugin))
		.pipe(gulp.dest(DEST));
});

gulp.task('assets', () => {
	return gulp
		.src(resources.assets)
		.pipe(plumber())
		.pipe(gulp.dest(DEST));
});

gulp.task('config', () => {
	return gulp
		.src(resources.module)
		.pipe(plumber())
		.pipe(through.obj(function(file, enc, next) {
			let config = JSON.parse(file.contents.toString());
			let {movian} = config;
			let predefinedProps = {
				file: resources.plugin
			};
			let configProps = Object
				.keys(movian)
				.filter((name) => movian[name] === null)
				.reduce((result, name) => {
					result[name] = predefinedProps[name] || config[name];
					return result;
				}, {});

			file.path = file.base + resources.config;
			file.contents = new Buffer(JSON.stringify(assign({}, movian, configProps)));

			this.push(file);
			next();
		}))
		.pipe(gulp.dest(DEST));
});

gulp.task('watch', ['default'], () => {
	gulp.watch(resources.source, ['plugin']);
	gulp.watch(resources.assets, ['assets']);
	gulp.watch(resources.module, ['config']);
});

gulp.task('default', ['plugin', 'assets', 'config']);
