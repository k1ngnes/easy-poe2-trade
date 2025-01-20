'use strict'

import { app } from 'electron'
import { uIOhook } from 'uiohook-napi'
import os from 'node:os'
import { startServer, eventPipe, server } from 'electron/server'
import { Logger } from 'electron/RemoteLogger'
import { GameWindow } from 'windowing/GameWindow'
import { OverlayWindow } from 'windowing/OverlayWindow'
import { GameConfig } from 'host-files/GameConfig'
// import { Shortcuts } from './shortcuts/Shortcuts'
import { AppTray } from 'electron/AppTray'
 import { OverlayVisibility } from 'windowing/OverlayVisibility'
import { GameLogWatcher } from 'host-files/GameLogWatcher'
import { HttpProxy } from 'electron/proxy'

if (!app.requestSingleInstanceLock()) {
  app.exit()
}

if (process.platform !== 'darwin') {
  app.disableHardwareAcceleration()
}
app.enableSandbox()

let tray: AppTray

app.on('ready', async () => {
  tray = new AppTray(eventPipe)
  const logger = new Logger(eventPipe)
  const gameLogWatcher = new GameLogWatcher(eventPipe, logger)
  const gameConfig = new GameConfig(logger)
  const poeWindow = new GameWindow()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _httpProxy = new HttpProxy(server, logger)
  setTimeout(
    async () => {
      const overlay = new OverlayWindow(eventPipe, logger, poeWindow)
      new OverlayVisibility(eventPipe, overlay, gameConfig)
      //const shortcuts = await Shortcuts.create(logger, overlay, poeWindow, gameConfig, eventPipe)
      eventPipe.onEventAnyClient('CLIENT->MAIN::update-host-config', (cfg) => {
        overlay.updateOpts(cfg.overlayKey, cfg.windowTitle)
        //shortcuts.updateActions(cfg.shortcuts, cfg.stashScroll, cfg.logKeys, cfg.restoreClipboard, cfg.language)
        gameLogWatcher.restart(cfg.clientLog ?? '')
        gameConfig.readConfig(cfg.gameConfig ?? '')
        tray.overlayKey = cfg.overlayKey
      })
      uIOhook.start()
      const port = await startServer(logger)
      logger.write(`info ${os.type()} ${os.release}`)
      overlay.loadAppPage(port)
      tray.serverPort = port
    },
    // fixes(linux): window is black instead of transparent
    process.platform === 'linux' ? 1000 : 0
  )
})