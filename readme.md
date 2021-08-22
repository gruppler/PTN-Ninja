PTN Ninja
===

This is an editor and viewer for [Portable Tak Notation (PTN)](https://ustak.org/portable-tak-notation/). It aims to be...

- Useful for transcription of live games, even on a phone.
- Intuitive, with a minimal UI that is enjoyable to use.
- Responsive, with a fluid design that works as well on a phone as it does in full-screen on a desktop.

## Prerequisites
- Quasar: https://quasar.dev/quasar-cli/installation
- Firebase: https://firebase.google.com/docs/emulator-suite/install_and_configure

## Install the dependencies
```bash
yarn
pushd functions && npm install; popd
```

### Sync the TPS-Ninja submodule
```bash
git submodule init && git submodule sync && git submodule update
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
yarn dev
```

### Start the server emulators
```bash
yarn emulate
```

### Lint the files
```bash
yarn lint
```

### Build the app for production
```bash
quasar build
```

Legal
---

&copy; 2020 Craig Laparo

This work is licensed under a GNU AGPLv3 [License](https://www.gnu.org/licenses/agpl-3.0.en.html).
