# Requirements

## Purpose

BLF / ASC / CSV のCANログと DBC を読み込み、DBCに基づいてsignalへdecodeし、選択したsignalを縦方向に並べてtimeline表示できるローカルデスクトップアプリを作成する。

主目的は、ログ内の任意範囲を拡大・縮小しながら、複数signalの時系列変化を比較・確認することである。

リアルタイム再生のニーズはない。

## Supported Inputs

- .blf
- .asc
- .csv
- .dbc

## Functional Requirements

### File Loading

- ローカルファイルから .blf / .asc / .csv / .dbc を選択できる
- 複数ログファイルを選択できる
- DBCファイルを選択できる
- 初回decode後はcacheを利用できる

### Log Concatenation

- 複数ログファイルを1つの解析用timelineとして連結できる
- MVPでは append 方式を優先する
- session_time と source_time を分離する
- source_file を保持する

### Signal Decode

- DBCに基づいてCAN frameをsignalにdecodeする
- signal名、message名、CAN ID、unitを保持する
- enum値がある場合はenum labelを保持する
- multiplexed signalは可能な範囲で対応する
- decodeできないframeは警告として集計する

### Signal Search

- signal名で検索できる
- message名で検索できる
- CAN IDで検索できる
- 最近使ったsignalを表示できる

### Timeline View

- 選択したsignalを 1 signal = 1 lane として縦に表示する
- 連続値は line 表示する
- 状態値・enum値は step 表示する
- zoom / pan / range selection ができる
- overview mini map を表示できる
- frontendへ全データを渡さず、表示範囲に応じて取得する

### Export

- 現在表示しているtimelineを PNG 保存できる
- PNG保存時の表示条件をJSONとして保存できる
- 保存先はユーザーが選択できる

### History

- 過去に開いたログ、DBC、選択signal、表示範囲を自動保存する
- 表示条件を復元できる
- 件数上限を超えたら古い履歴から削除する

### Cache

- decode済みデータをcacheできる
- cache容量上限を超えたら古いcacheから削除する
- historyとcacheは分離する

## Non-Requirements

The following features are intentionally out of scope:

- リアルタイム再生
- 再生速度変更
- CAN送信
- 実機接続
- クラウド保存
- ユーザー認証
- 大量のツールバーボタン
- ブランド名や製品名の作り込み