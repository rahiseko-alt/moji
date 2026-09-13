# MattStyle-0

Matt Pocock 氏の [mattpocock/skills](https://github.com/mattpocock/skills) をそのまま使う開発フロー用リポジトリです。

## セットアップ済みの内容

- `.claude/skills/` に本家のスキルを 12 個インストール（`npx skills add mattpocock/skills`、`skills-lock.json` でバージョン固定）
  - ユーザー起動: `grill-me` / `grill-with-docs` / `to-spec` / `to-tickets` / `implement` / `improve-codebase-architecture` / `setup-matt-pocock-skills`
  - モデル起動: `grilling` / `domain-modeling` / `codebase-design` / `tdd` / `code-review`
- `AGENTS.md`: `## Agent skills` 設定ブロックと開発フロー
- `docs/agents/issue-tracker.md`: Issue tracker は GitHub Issues（`gh` CLI）
- `docs/agents/domain.md`: ドメイン文書は single-context（`CONTEXT.md` + `docs/adr/`）

`triage` スキルは未導入のため、本家 `setup-matt-pocock-skills` の仕様どおり `docs/agents/triage-labels.md` は作成していません。

## 使い方（覚えるのはこの3つだけ）

| 打つもの | 何が起きるか |
| --- | --- |
| `s` | 前回の続き・いまの状態・最初の一手を報告します（開始時は自動でも出ます） |
| `f` | 環境を破棄しても大丈夫な状態まで片づけ、終了して良いかを報告します |
| `/next-step` | いまどこにいて、次に何を打てばいいかを1つだけ提示します |

コマンドを覚える必要はありません。「〇〇を作りたい」と伝えるだけでも、実装前に自動で案内が入ります。

### 仕組み

- `.claude/skills/s/`, `.claude/skills/f/`: セッションの開始と終了の儀式（リポジトリ独自スキル）
- `.claude/skills/next-step/`: 現在地を診断し、次の1コマンドを提示するリポジトリ独自スキル（本家スキルとは別物）
- `.claude/settings.json`: セッション開始時に `docs/agents/flow-map.md` を読み込む `SessionStart` フック
- `docs/agents/flow-map.md`: 「フロー未経由の実装依頼は `next-step` を先に通す」という行動規則
- `docs/agents/handover.md`: セッションをまたぐ引き継ぎメモ（決めたこと／次にやること／未解決の問題）。区切りごとに自動で追記され、会話開始時に直近の数件が読み込まれます

### フロー全体

フローは [AGENTS.md](./AGENTS.md) の「Development flow」を参照してください。

- 新規開発: `/grill-me` → 必要に応じて `/to-spec` → `/to-tickets` → `/implement`
- 機能追加: `/grill-with-docs` → 必要に応じて `/to-spec` → `/to-tickets` → `/implement`
- 設計改善: `/improve-codebase-architecture` → 候補を選択 → `/grill-with-docs` または `/codebase-design` → `/to-spec` → `/to-tickets` → `/implement`

`/implement` は `/tdd` で RED → GREEN の vertical slice を繰り返し、最後に `/code-review` を実行します。

## スキルの更新

```bash
npx skills update
```

スキル本体は本家のまま使う方針のため、ローカルで書き換えないでください。
