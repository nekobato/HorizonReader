# Oneline Browser

## 概要

Oneline Browserは、シンプルな通常のブラウザとしての機能と、開いているページの文章の１行分だけの高さしかない特殊な見た目を持つWebブラウザです。
文章がメインのWebサイト（小説サイト・ブログなど）を画面の上下どちらかの隅っこで閲覧するためのブラウザです。

Oneline Browserは、その特徴的なUIを活用するための補助的な機能を持ちます。

- 読みたい文章のまとまりを指定する
- 上下キーで対象の文章の１行分だけスクロール

もちろん、通常のスクロール操作は通常のブラウザと同じく行えます。

OnelineBrowserはメインのウィンドウ(Main)が特殊なサイズのため、通常のブラウザ操作を行うためのUIはサブウインドウ（Controller）で提供されます。
Contollerは普段非表示ですが、Mainの右端にあるアイコンボタン`mingcute:remote-control-line`から表示を切り替えられます。
Controllerは、メインのウィンドウの上または下の、画面上の余白が広い方に表示されます。
Controllerは、余白を掴むことでドラッグ出来ます。
Controllerは、進む, 戻る, URL, 更新のUIを持ちます。そのほかのUIは一旦持ちません。
Controllerはサイズ固定です。閉じるボタンを持ちます。
アプリの終了はControllerまたはシステムバーから行います。

MainにはDOM要素のまとまりを判別し、クリックして対象のDOMを指定する機能を持ちます。
Main右端にある`mingcute:align-left-line`のアイコンボタンを押すことで、DOM指定モードに切り替わります。
DOM指定をすると、Mainの高さは対象のDOMのline-heightに切り替わり、対象のDOMの最上部にスクロールが移動します。
ユーザーはその状態から文章を読み始めるというのが想定した利用法です。

## 履歴と読書位置

Controllerの履歴ボタンから、過去に開いたページを一覧表示できます。
履歴にはURL、ページタイトル、最後に指定した対象DOM、スクロール位置が保存されます。
履歴からページを開くと、保存済みの対象DOMを再選択し、スクロール位置を復元します。

## 技術的仕様

以下の最新版を使う。

- Vue.js
- Electron
- electron-store
- pinia
- iconify/vue

## リリースと自動アップデート

Oneline Browserは`electron-updater`を使って、GitHub Releasesにアップロードされたリリース成果物を更新元として参照します。

通常のローカル確認用 `.app` は次のコマンドで作成します。

```sh
npm run package
```

GitHub Releasesへアップロードする前に配布物をローカル生成して確認する場合は次のコマンドを使います。

```sh
npm run dist
```

`release/`に`dmg`, `zip`, `blockmap`, `latest-mac.yml`が生成されます。自動アップデートは`latest-mac.yml`からzipを取得して更新します。

GitHub Releasesへアップロードする配布物は次のコマンドで作成・公開します。

```sh
GH_TOKEN=... npm run publish:github
```

このコマンドは`electron-builder`のGitHub providerを使い、`nekobato/OnelineBrowser`のGitHub ReleaseへmacOS向けartifactと更新メタデータをアップロードします。
アプリは起動時に同じGitHub Releaseを確認し、更新が見つかった場合は自動でダウンロードします。ダウンロード済みの更新はControllerの更新ボタンから即時インストールできます。

macOSの自動アップデートを実運用する場合、配布するアプリは署名・必要に応じてnotarizeしてください。未署名ビルドはローカル検証には使えますが、macOS上の自動更新インストールで制約を受けます。
GitHub Releasesはアプリから参照できる公開状態にしてください。private repositoryのReleaseを更新元にする場合、実行時の認証情報管理が別途必要になります。
