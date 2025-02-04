# MInDes LSP

[![License: WTFPL](https://img.shields.io/badge/License-WTFPL-brightgreen.svg)](http://www.wtfpl.net/about/)

A simple extension to enable several VS Code features for editing the MInDes input file. 

## Intro

This extension is for MInDes input file. It is a modification on the VS Code extension example: [lsp-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample). 

[MInDes](https://github.com/Microstructure-Intelligent-Design/MInDes) 
([**M**aterial **In**telligent **Des**ign](https://github.com/Microstructure-Intelligent-Design)) 
is a phase field simulation package using MInDes input file script to pass the simulation parameters to the program. 

This extension attempts to add grammar support to this script language, includes completion and code grammar highlight for the keywords used in the input file.
Please notice that this extension does not support complete VS Code features. 

## How to use it?

Just open your VS Code and find `Extensions` (`Ctrl+Shift+X`), then choose *install from VSIX...*, find the vsix file in the release to install.
After that, you could open a MInDes input file (with postfix "mindes"), then this extension should begin to work.

## License

This extension is under WTFPL. Feel freeeee to do anything.