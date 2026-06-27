# Use Cases

## 目的

本アプリは、BLF / ASC / CSV の CANログを開き、固定 DBC に基づいて signal へ decode し、選択した signal を timeline 上で比較・確認するためのローカル解析ビューアである。

主目的は、ログ内の任意範囲を視覚的に確認し、必要に応じて timeline を PNG として保存することである。

リアルタイム再生、CAN送信、DBC編集、複雑なダッシュボード作成は目的外とする。

---

## UI設計思想

### 基本方針

- ユーザーの主操作は `Open Log` から始まる。
- cache は内部実装であり、通常ユーザーに選ばせない。
- UIはモダンにするが、常時表示するボタンや情報は最小限にする。
- 解析対象は signal timeline であり、余計な情報表示で画面を埋めない。
- 操作は、ボタンよりも timeline 上のクリック・ドラッグ・hover に寄せる。
- CANalyzer相当の操作感は参考にするが、全機能を再現しない。

### 表示するもの

- Open Log
- Export
- 開いているログファイル名の basename
- Signals ペイン
- signal検索欄
- selected signal tag
- timeline
- session_time の横軸
- point表示
- cursor bar
- range selection overlay
- hover tooltip

### 表示しないもの

- cache path
- source file full path
- signal数
- time range の常時表示
- Start / End 入力box
- cursorTime / signal値一覧の上部表示
- 再生ボタン
- 再生速度
- Save View ボタン
- DBC選択UI

### 操作方針

- signalは検索して選ぶ。
- 選択済みsignalは tag として表示する。
- timelineに表示できるsignalは最大5個とする。
- 表示範囲は Start / End 入力boxではなく、timeline上のドラッグで選択する。
- Fit All相当の機能は残す。
- cursor bar は timeline 上に永続表示する。
- hover tooltip は点の詳細確認に限定する。
- Signals ペインは固定幅とし、signal list のみスクロールする。
- Signals ペインは閉じられるようにする。

---

## UC-01: CANログファイルを開く

### 目的

ユーザーが解析対象の CANログを開き、signal表示まで進める。

### 対象ファイル

- `.blf`
- `.asc`
- `.csv`

### 基本フロー

1. ユーザーが `Open Log` を押す。
2. `.blf` / `.asc` / `.csv` を選択する。
3. アプリが内部的に decode cache を生成または再利用する。
4. アプリが signal 一覧を表示する。
5. UI上に開いているログファイル名の basename を表示する。

### 備考

- ユーザーに cache directory は選ばせない。
- DBC は固定 `default.dbc` を使う。
- `--dbc` CLI option は追加しない。
- DBC選択UIは追加しない。
- 表示するファイル名は basename のみとする。
- full path や cache path は表示しない。

---

## UC-02: signalを検索する

### 目的

解析したい signal を素早く見つける。

### 検索対象

- signal name
- message name
- CAN ID

### 基本フロー

1. ユーザーが Signals ペインの検索欄にキーワードを入力する。
2. 一致する signal が一覧表示される。
3. ユーザーが signal を選択する。

### 備考

- Signals ペインは固定幅とする。
- signal list だけをスクロールさせる。
- signal数が多くても Signals ペイン全体を縦に伸ばさない。
- window全体や timeline area を signal数で押し広げない。

---

## UC-03: signalをtimelineに表示する

### 目的

選択した signal の時系列変化を確認する。

### 基本フロー

1. ユーザーが signal を選択する。
2. 選択された signal が tag として表示される。
3. timeline に `1 signal = 1 lane` で表示される。
4. 値は point として表示される。

### 制約

- timelineに表示できる signal は最大5個とする。
- 6個目を選択しようとした場合は追加しない。
- 6個目の選択時は軽い warning を出す。
- 選択済み signal の解除は可能とする。

---

## UC-04: signal選択履歴を使う

### 目的

過去によく選択した signal を再利用し、signal検索の手間を減らす。

### 基本フロー

1. ユーザーが signal を選択する。
2. アプリが選択された signal を履歴に保存する。
3. 次回以降、Signals ペインに最近選択した signal を表示する。
4. ユーザーは履歴から signal を再選択できる。

### 保存対象

- signal name
- message name
- CAN ID
- unit
- 最終選択日時
- 選択回数

### 備考

- signal選択履歴は UI補助機能であり、主機能ではない。
- 履歴表示でUIを重くしない。
- 履歴は Signals ペイン内に控えめに表示する。
- 履歴数には上限を設ける。
- 例: 最近選択した signal を最大10件表示する。
- 履歴削除や詳細管理UIは初期実装では不要。

---

## UC-05: timelineの時間軸を見る

### 目的

signal値がどの時刻で変化したかを確認する。

### 基本フロー

1. timeline に session_time の横軸を表示する。
2. 各 lane は同じ x scale を共有する。
3. grid line により時刻位置を把握できる。

### 備考

- 横軸単位は秒とする。
- source_file / file path は通常表示しない。
- 時刻は session_time を使う。

---

## UC-06: グラフ上で範囲を選択する

### 目的

Start / End 数値入力ではなく、グラフ操作で表示範囲を絞る。

### 基本フロー

1. ユーザーが timeline 上をドラッグする。
2. 選択範囲 overlay が表示される。
3. ドラッグ終了時に表示範囲が更新される。
4. 選択範囲の signal data が再取得・再表示される。

### 備考

- Start / End input box は表示しない。
- 数値入力よりグラフ操作を主とする。
- 選択範囲は半透明 overlay で示す。

---

## UC-07: Fit Allで全範囲に戻す

### 目的

絞り込んだ範囲から、ログ全体表示に戻す。

### 基本フロー

1. ユーザーが Fit All 相当の操作を行う。
2. timeline の表示範囲がログ全体に戻る。
3. cursor bar が表示範囲外なら範囲開始へ戻る。

### UI方針

- ボタンを増やしすぎない。
- 可能なら timeline ダブルクリックで Fit All を実行する。
- 明示ボタンを置く場合も小さく控えめにする。

---

## UC-08: cursor barを置く

### 目的

特定時刻を基準点として timeline 上に残す。

### 基本フロー

1. 初期状態では cursor bar を 0s または表示範囲開始に置く。
2. ユーザーが timeline をクリックする。
3. クリック位置に cursor bar が移動する。
4. cursor bar は hover していない時も永続表示される。

### 備考

- cursor bar は全laneを貫く縦線として表示する。
- 上部に cursorTime や signal値一覧は表示しない。
- bar上部の時刻ラベルも表示しない。
- cursor bar の目的は、基準時刻を視覚的に保持することである。

---

## UC-09: pointをhoverして値を見る

### 目的

特定の点の signal値を確認する。

### 基本フロー

1. ユーザーが timeline 上の point に hover する。
2. tooltip に点の情報が表示される。

### 表示項目

- signal_name
- session_time
- value
- enum_label
- unit

### 表示しない項目

- source_file
- file path
- cache path

---

## UC-10: Signalsペインを閉じる

### 目的

timeline 表示領域を広く使う。

### 基本フロー

1. ユーザーが Signals ペインを閉じる。
2. timeline 領域が横方向に広がる。
3. 選択済み signal と timeline 表示は維持される。
4. ユーザーが再度 Signals ペインを開く。

### 備考

- Signalsペインの開閉は表示状態のみ変更する。
- 選択済みsignalは消さない。
- Signalsペインを閉じても query結果や cursor bar は維持する。

---

## UC-11: timelineをPNG保存する

### 目的

現在表示している timeline を報告・共有用に画像保存する。

### 基本フロー

1. ユーザーが `Export` を押す。
2. 保存先を選択する。
3. 現在表示中の timeline 領域だけを PNG として保存する。

### PNGに含めるもの

- timeline
- point
- 横軸時間
- grid
- cursor bar
- selection overlay

### PNGに含めないもの

- Signalsペイン
- Open Log / Export ボタン
- 開いているファイル名表示
- hover tooltip

### 備考

- Export形式は PNG のみとする。
- PDF / CSV / JSON export は初期対象外とする。

---

## UC-12: 開いているファイル名を確認する

### 目的

現在どのログを解析しているかをユーザーが把握する。

### 基本フロー

1. ユーザーが Open Log でログを開く。
2. UI上に log file の basename のみを表示する。

### 例

```text
sample.blf
````

### 表示しないもの

* full path
* cache path
* signal count
* time range

---

## UC-13: decode cacheを自動利用する

### 目的

同じログを再度開いたときに高速化する。

### 基本フロー

1. ユーザーがログファイルを開く。
2. アプリが log path / size / modified time などから cache key を生成する。
3. 既存 cache が有効なら decode をスキップする。
4. cache がなければ decode する。

### 備考

* cache は内部実装とする。
* ユーザーに cache directory は選ばせない。
* 本格的な LRU / ring buffer は別Phaseで扱う。

---

## UC-14: decode失敗を確認する

### 目的

ログが読めない、DBC不一致、壊れたCSVなどの問題をユーザーに知らせる。

### 基本フロー

1. Open Log または decode 中にエラーが発生する。
2. UIに簡潔なエラーを表示する。
3. アプリは固まらない。

### 対象エラー例

* unsupported_log_type
* csv_missing_columns
* malformed_csv_row
* unknown_message
* decode_error
* empty_log
* log_read_error

---

## UC-15: 開発用sample logを生成する

### 目的

実ログがなくても UI / backend を確認できるようにする。

### 基本フロー

1. 開発者が `scripts/generate_sample_blf.py` を実行する。
2. `samples/sample.blf` が生成される。
3. Open Log で `samples/sample.blf` を開く。
4. Speed / Gear を表示確認する。

### 用途

* 開発確認
* regression test
* 初回セットアップ確認
* 実ログが手元にない場合の動作確認

### 備考

* sample log は開発用であり、通常ユーザー向けの主機能ではない。
* sample log 生成機能はアプリUIには出さない。
* CLI / script として提供する。

---

## 優先度整理

| 優先度    |    ID | ユースケース               |
| ------ | ----: | -------------------- |
| Must   | UC-01 | CANログファイルを開く         |
| Must   | UC-02 | signalを検索する          |
| Must   | UC-03 | signalをtimelineに表示する |
| Should | UC-04 | signal選択履歴を使う        |
| Must   | UC-05 | timelineの時間軸を見る      |
| Must   | UC-06 | グラフ上で範囲を選択する         |
| Must   | UC-07 | Fit Allで全範囲に戻す       |
| Must   | UC-08 | cursor barを置く        |
| Must   | UC-09 | pointをhoverして値を見る    |
| Must   | UC-10 | Signalsペインを閉じる       |
| Must   | UC-11 | timelineをPNG保存する     |
| Should | UC-12 | 開いているファイル名を確認する      |
| Should | UC-13 | decode cacheを自動利用する  |
| Should | UC-14 | decode失敗を確認する        |
| Dev    | UC-15 | 開発用sample logを生成する   |

---

## 現時点で対象外

* リアルタイム再生
* 再生速度変更
* CAN送信
* DBC選択UI
* `--dbc` CLI option
* Save View
* PDF export
* CSV export
* history/cache ring buffer
* 複数ログ結合の高度機能
* manual time offset
* クラウド保存
* ユーザー認証

```
