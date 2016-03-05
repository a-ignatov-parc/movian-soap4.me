import gulp from 'gulp';

import config from './package.json';

const SOURCE = './src';
const DEST = './out';

gulp.task('build', () => {
	return gulp
		.src(`${SOURCE}/**/*.js`)
		.pipe(gulp.dest(DEST));
});

gulp.task('default', ['build']);
