# Search First Rule

新規実装やリファクタ前に、必ず既存コード・設定・依存関係・関連ドキュメントを検索すること。

最低限確認するもの:
- grep / find による既存実装の検索
- package.json の依存関係
- tsconfig.json の設定
- README.md / CLAUDE.md
- .claude/rules/ の関連ルール
- .rwl/lessons/ の失敗/成功パターン

禁止:
- 調査前に新規ファイルを作成する
- 既存パターンを無視して実装する
- 依存関係を重複追加する
- 同名・類似機能の実装が既にあるか確認せずに抽象ユーティリティを新設する
