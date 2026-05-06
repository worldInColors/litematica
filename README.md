[![](https://jitpack.io/v/sakura-ryoko/litematica.svg)](https://jitpack.io/#sakura-ryoko/litematica)

Litematica
==============
Litematica is a client-side Minecraft mod using LiteLoader.
It is more or less a re-creation of or a substitute for [Schematica](https://www.curseforge.com/minecraft/mc-mods/schematica),
for players who don't want to have Forge installed.
For compiled builds (= downloads), see https://www.curseforge.com/minecraft/mc-mods/litematica/files/all

Compiling
=========
* Clone the repository
* Open a command prompt/terminal to the repository directory
* run 'gradlew build'
* The built jar file will be in build/libs/

Web downgrade tool
==================
This repository includes a small browser-based tool for downgrading Litematica v7 schematics to v6 (Minecraft 1.20.4).

From the repository root:
* `cd web`
* `npm install`
* `npm run dev`
* Open the local URL printed by Vite and upload a `.litematic` file
