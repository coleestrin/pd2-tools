# pd2-tools

[![Discord](https://img.shields.io/discord/1311407302149931128?label=Discord&logo=discord&logoColor=white)](https://discord.gg/TVTExqWRhK)
[![GitHub Stars](https://img.shields.io/github/stars/coleestrin/pd2-tools?style=flat&logo=github)](https://github.com/coleestrin/pd2-tools/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/coleestrin/pd2-tools?style=flat&logo=github)](https://github.com/coleestrin/pd2-tools/network/members)
[![License](https://img.shields.io/github/license/coleestrin/pd2-tools)](https://github.com/coleestrin/pd2-tools/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/coleestrin/pd2-tools)](https://github.com/coleestrin/pd2-tools/graphs/contributors)

A suite of tools for **[Project Diablo 2](https://www.projectdiablo2.com/)** designed to track builds, monitor the meta, explore characters, and provide insights into the PD2 economy and playerbase. Live at [pd2.tools](https://pd2.tools/).

This repository includes everything except the [character exporter](https://pd2.tools/tools/character-export) which can be found at [coleestrin/pd2-character-downloader](https://github.com/coleestrin/pd2-character-downloader).


## 🔧 Setup

1. `git clone https://github.com/coleestrin/pd2-tools`

**API:**

1. `cd api`
2. `npm i`
3. Fill out the `.env`, example given in `.env.example`
4. `npm run build`
5. `npm start` to start the API
6. `npm run jobs` to run background jobs (player count tracking and character scraper)

**Frontend:**

1. `cd web`
2. `npm i`
3. Fill out the `.env`, example given in `.env.example`
4. `npm run dev` or: `npm run build` and then `npm run preview`

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
