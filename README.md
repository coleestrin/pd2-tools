<div align="center">
  <h1>pd2.tools</h1>
  <p>
    <a href="https://discord.gg/TVTExqWRhK"><img alt="Discord" src="https://img.shields.io/discord/1311407302149931128?label=Discord&amp;logo=discord&amp;logoColor=white" /></a>
    <a href="https://github.com/coleestrin/pd2-tools/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/coleestrin/pd2-tools?style=flat&amp;logo=github" /></a>
    <a href="https://github.com/coleestrin/pd2-tools/network/members"><img alt="GitHub Forks" src="https://img.shields.io/github/forks/coleestrin/pd2-tools?style=flat&amp;logo=github" /></a>
    <a href="https://github.com/coleestrin/pd2-tools/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/coleestrin/pd2-tools" /></a>
    <a href="https://github.com/coleestrin/pd2-tools/graphs/contributors"><img alt="Contributors" src="https://img.shields.io/github/contributors/coleestrin/pd2-tools" /></a>
  </p>
  <p><a href="https://pd2.tools/">pd2.tools</a> is an open source <a href="https://www.projectdiablo2.com/">Project Diablo 2</a> toolkit for exploring builds, tracking the economy, browsing game data, and more.</p>
  <p>
    <img alt="pd2.tools demonstration" src="https://coleestrin.io/pd2-readme.png" />
  </p>
</div>

<hr>

## 🔧 Setup

```bash
git clone https://github.com/coleestrin/pd2-tools
cd pd2-tools
```

**Optional**: copy `.env.example` to `.env` to override the Docker defaults.

**Production**:

```bash
docker compose up --build
```

**Dev**:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile jobs up --build
```

Open `http://localhost:4173`

### Damage Regression Snapshot

The API includes a sampled real-character damage snapshot for calculator
regression coverage. The snapshot is generated from the public character API and
keeps only characters that pass main-skill quality gates: level 80+, base and
effective target skill level 20+, enough maxed synergy investment where the game
data exposes synergies, and target skill damage at least 50% of the character's
best no-manual-aura modeled profile.

```bash
cd api
npm run damage:snapshot
npx jest src/utils/damage-regression-snapshot.test.ts --runInBand
```

Useful generation knobs:

- `DAMAGE_REGRESSION_SEASON`: season to sample, default `13`.
- `DAMAGE_REGRESSION_GAME_MODES`: comma-separated modes, default `softcore`.
- `DAMAGE_REGRESSION_MAX_SKILLS`: cap the number of usage-ranked skills sampled.
- `DAMAGE_REGRESSION_TARGET_SAMPLES_PER_SKILL`: desired qualified samples per skill, default `3`.
- `DAMAGE_REGRESSION_MIN_SAMPLES_PER_SKILL`: minimum retained samples per skill, default `2`.

## 🤝 Contributing

Contributions are welcome. For coordination or questions join the [pd2.tools discord](https://discord.com/invite/TVTExqWRhK).

### Getting Started

1. Fork the repo.
2. Create a feature branch.
3. Make your changes.
4. Submit a PR.

## 👥 Contributors

<a href="https://github.com/coleestrin/pd2-tools/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=coleestrin/pd2-tools" />
</a>

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=coleestrin/pd2-tools&type=date&legend=top-left)](https://www.star-history.com/#coleestrin/pd2-tools&type=date&legend=top-left)
