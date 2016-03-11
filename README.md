## Requirements

- [Movian](https://movian.tv/) media player.
- Extended account on [soap4.me](https://soap4.me/) service.

## Try beta versions

You can help with plugin development by testing latest builds before they are available to public. All you need to do is to add `soap4me` password to "Beta testing passwords" section in player's settings.

> `Settings → General → Plugins`

## How to build your own plugin

Clone a copy of the main repo by running:

```bash
git clone git://github.com/a-ignatov-parc/movian-soap4.me.git
```

Enter the plugin directory and run the build script:

```bash
cd movian-soap4.me && npm run build
```
The built version of plugin will be put in the `out/` subdirectory.