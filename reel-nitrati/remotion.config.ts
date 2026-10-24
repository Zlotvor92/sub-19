import {Config} from '@remotion/cli/config';

// Sistemski Chromium headless shell (bez preuzimanja sa mreže)
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(4);
Config.setCodec('h264');
Config.setCrf(12);
Config.setPixelFormat('yuv420p');
