# CAN Log Viewer

BLF / ASC / CSV のCANログと DBC を読み込み、DBCに基づいてsignalへdecodeし、選択したsignalを縦方向に並べてtimeline表示するローカルデスクトップアプリ。

## Purpose

主目的は、CANログ内の任意範囲を拡大・縮小しながら、複数signalの時系列変化を比較・確認することである。

リアルタイム再生のニーズはない。再生ボタン、再生速度変更、リアルタイムカーソル移動は不要。

## Target

- Windows向け exe 配布
- ローカルファイル読み込み
- DBC decode
- signal検索
- 縦積みtimeline表示
- PNG export
- 表示履歴とdecode cacheの自動管理

## Main Requirements

- .blf / .asc / .csv / .dbc をローカルから選択できる
- 複数ログファイルを1つの解析用timelineとして連結できる
- session_time と source_time / source_file を分離して保持する
- signal名 / message名 / CAN ID で検索できる
- 選択したsignalを 1 signal = 1 lane として縦に並べて表示できる
- 連続値は line、状態値・enum値は step で表示できる
- zoom / pan / range selection ができる
- 現在表示しているtimelineを PNG 保存できる
- 表示条件を自動保存し、後から復元できる
- 履歴とdecode cacheはリングバッファ方式で古いものから削除する

## UI Policy

- ツール名やブランド名を強調しない
- 常時表示するボタンは最小限にする
- 主要ボタンは Open と Export 程度に限定する
- Save View は手動ボタンではなく自動保存にする
- zoom / pan / range select はマウス操作で行う
- signal追加は検索結果クリック、削除は選択済みtagの×で行う
- 補助操作は右クリックメニューまたはdrawerに隠す
- リアルタイム再生UIは置かない

## Proposed Stack

- UI: Tauri + React + TypeScript
- Backend: Python
- CAN log reader: python-can
- DBC decode: cantools
- Cache: parquet + duckdb
- Timeline: uPlot or Plotly.js

## Development Status

Initial planning phase.