# AIR DARTS

カメラで手を認識して遊ぶ、1人用のダーツゲームです。3投×8ラウンドで合計得点を競います。

## 起動

Node.js 22.13以上が必要です。

```powershell
npm ci
npm run dev
```

表示された localhost のURLを開きます。カメラ利用には localhost または HTTPS が必要です。初回の手認識モデル読み込みにはインターネット接続が必要です。

## 遊び方

1. 「カメラで遊ぶ」を押してカメラを許可します。
2. 明るい場所で、開いた片手全体を映します。人差し指の位置で照準を動かします。
3. 親指と人差し指を約0.2秒つまみ、離すと投げます。照準が黄色になれば投げられます。
4. 24投で終了。「もう一度遊ぶ」で再開できます。

マウスは盤をクリック、タッチはタップ。盤にキーボードフォーカスを当てると、矢印キーで照準移動、スペースで投げられます。カメラ利用中はポインター操作を無効化します。

通常エリアは数字の点数、外側の細い帯は2倍、内側の細い帯は3倍、外ブル25点、中心50点、盤外0点です。連投防止の待ち時間は0.85秒です。最後のラウンドの着弾位置を表示します。

映像・手の座標はブラウザ内で処理し、送信・保存しません。モデルとライブラリーはGoogle / jsDelivrからダウンロードします。実カメラの認識精度は照明・距離・カメラ画角に依存します。

## 開発

React / TypeScript / Canvas / MediaPipe Hand Landmarker。

```powershell
npm run build
npx tsc --noEmit
node --experimental-strip-types --test tests/darts.test.mjs
```

手認識は [MediaPipe公式ガイド](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) を参照しています。
