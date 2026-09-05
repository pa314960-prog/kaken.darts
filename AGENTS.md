# Pa の開発方針

- ユーザー名は Pa。日本の工業高校で電気科系を学んでいる。
- 電気、陸上競技、ガジェット、電子工作、TouchDesigner、LiDARに関心がある。
- 説明は簡潔に、一つずつ段階的にする。
- 作り方の説明だけで終わらず、可能なら実際の制作・実装まで進める。

# このゲーム

- 日本語UIのカメラダーツ。手をつまんで離して投げる。
- 映像と手の座標をサーバーへ送信しない。
- 採点とジェスチャー変更時は `node --experimental-strip-types --test tests/darts.test.mjs` を実行する。
- 検証は `npx tsc --noEmit` と `npm run build`。
