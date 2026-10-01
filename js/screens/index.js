// Registro de pantallas.
import { TitleScreen } from './title.js';
import { FlightScreen } from './flight.js';
import { MapScreen } from './map.js';
import { EventScreen } from './event.js';
import { StationScreen } from './station.js';
import { HangarScreen } from './hangar.js';
import { CrewScreen } from './crew.js';
import { NewGameScreen } from './newgame.js';
import { LoadScreen } from './load.js';
import { SettingsScreen } from './settings.js';
import { HelpScreen } from './help.js';
import { ArchiveScreen } from './archive.js';
import { GameOverScreen } from './gameover.js';

export function registerScreens(sm) {
  sm.register('title', TitleScreen);
  sm.register('flight', FlightScreen);
  sm.register('map', MapScreen);
  sm.register('event', EventScreen);
  sm.register('station', StationScreen);
  sm.register('hangar', HangarScreen);
  sm.register('crew', CrewScreen);
  sm.register('newgame', NewGameScreen);
  sm.register('load', LoadScreen);
  sm.register('settings', SettingsScreen);
  sm.register('help', HelpScreen);
  sm.register('archive', ArchiveScreen);
  sm.register('gameover', GameOverScreen);
}
