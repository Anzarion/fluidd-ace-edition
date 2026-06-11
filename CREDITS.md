# Credits & lineage

**Fluidd - ACE Pro Edition** is my personal, unofficial fork - tailored to my own printer and
setup, deviating from the source repos, and very unlikely to work as a drop-in replacement
elsewhere. It stands on a chain of open-source work; this file records that lineage and the
licenses involved.

This fork is licensed **GPL-3.0**, the same as Fluidd. Use at your own risk - no warranty.
It is **not affiliated with or endorsed by** the Fluidd team or Anycubic.

## Base UI

- **[Fluidd](https://github.com/fluidd-core/fluidd)** - the Klipper web interface this
  project forks, by the Fluidd contributors. **License: GPL-3.0.**

## ACE Pro panel lineage

The Anycubic ACE Pro panel in this fork descends from:

- **[swilsonnc/ACEPROK1Max](https://github.com/swilsonnc/ACEPROK1Max)** - the original
  native ACE Pro panel for Fluidd and Mainsail (the panel scaffold, base ACE commands, and
  the material-temperature defaults this panel still uses). **License: GPL-3.0.**
- **[jeng37/ACE-Mainsail-Fluidd-Patch](https://github.com/jeng37/ACE-Mainsail-Fluidd-Patch)**
  - the "ACE Hybrid Native" adaptation, which repackaged swilsonnc's panel for the Kobra-S1
  ACE driver. This fork's driver-addressing / data layer in `aceApi.js` (`save_variables`
  parsing, inventory/tool normalization, Spoolman sync, dryer logic) derives from this work.
  **License: _pending_** - this work is itself a derivative of swilsonnc's GPL-3.0 panel;
  attribution is recorded here and a license confirmation has been requested.

swilsonnc's panel and the Kobra-S1 driver in turn build on the ACE Pro driver & research
foundation below.

## ACE Pro driver & research foundation

The panel reads and commands an Anycubic ACE Pro Klipper driver, and was originally adapted
for one. The whole ACE-on-Klipper effort - panels and drivers alike - stands on this work
(as credited by swilsonnc and the szkrisz / Kobra-S1 driver chain):

- **[printers-for-people/ACEResearch](https://github.com/printers-for-people/ACEResearch)** -
  the original Anycubic ACE Pro reverse-engineering / protocol research.
- **[utkabobr/DuckACE](https://github.com/utkabobr/DuckACE)** - base ACE driver
  implementation. **License: GPL-3.0.**
- **[BlackFrogKok/BunnyACE](https://github.com/BlackFrogKok/BunnyACE)** - base driver fork.
  **License: GPL-3.0.**
- **[szkrisz/ACEPROSV08](https://github.com/szkrisz/ACEPROSV08)** - the ACE Pro Klipper
  driver everything here forks from. **License: GPL-3.0.**
- **[agrloki/ValgACE](https://github.com/agrloki/ValgACE)** - ACE driver and standalone
  dashboard (its temperature-sensor integration and dashboard were adopted downstream).
  **License: GPL-3.0.**
- **[Kobra-S1/ACEPRO](https://github.com/Kobra-S1/ACEPRO)** - fork of szkrisz/ACEPROSV08 for
  the Anycubic Kobra S1; the driver jeng's panel was adapted for, and the direct parent of
  the driver used here. **License: GPL-3.0.**
- **[Anzarion/ACEPRO](https://github.com/Anzarion/ACEPRO)** (branch
  [`feat/pump-time-tangle-detector`](https://github.com/Anzarion/ACEPRO/tree/feat/pump-time-tangle-detector))
  - my fork of Kobra-S1/ACEPRO used with this panel; adds pump-time tangle detection, proposed
  upstream in [Kobra-S1/ACEPRO#18](https://github.com/Kobra-S1/ACEPRO/pull/18). **License: GPL-3.0.**

## Spool weight integration (FilaMan)

Real spool weights come from **FilaMan**, a scale-based filament manager, read over a
Moonraker proxy (no FilaMan code is bundled here):

- **[Fire-Devils/filaman-system](https://github.com/Fire-Devils/filaman-system)** - the
  FilaMan server this panel queries. **License: MIT.**
- **[Fire-Devils/FilaMan-System-ESP32](https://github.com/Fire-Devils/FilaMan-System-ESP32)** -
  the original ESP32 scale firmware. **License: MIT.**
- **[Anzarion/FilaMan-System-ESP32](https://github.com/Anzarion/FilaMan-System-ESP32)** - my
  fork of that firmware, adapted to write ACE-compatible RFID tags (the
  `VENDOR-MATERIAL-SPOOLID` SKU the panel and driver parse). **License: MIT.**

## This fork's additions (Anzarion)

On top of the above, this fork contributes:

- a complete rewrite of the panel as a **native Vue single-file component**
  (`AceProPanelCard.vue`) instead of injected / minified-bundle patching;
- **real spool weights via FilaMan** through a Moonraker proxy;
- a **sensor-driven live filament path**, RFID badge, spool-fill visual, and
  column-width-responsive tiles;
- several additional ACE commands and robustness fixes;
- packaging as a maintainable Fluidd fork with CI-built releases.

## My setup (this is why it is not a drop-in)

The panel is built against my specific stack and assumes it is present and configured:

- **ACE Pro driver:**
  [Anzarion/ACEPRO @ `feat/pump-time-tangle-detector`](https://github.com/Anzarion/ACEPRO/tree/feat/pump-time-tangle-detector)
  - provides the `ACE_*` macros, the `save_variables` inventory, and the named filament
  sensors (`filament_toolhead` / `filament_nozzle`) the panel reads.
- **Scale firmware:**
  [Anzarion/FilaMan-System-ESP32](https://github.com/Anzarion/FilaMan-System-ESP32) - writes
  the ACE-compatible SKU tags.
- **FilaMan server:**
  [Fire-Devils/filaman-system](https://github.com/Fire-Devils/filaman-system) - serves the
  real spool weights via the Moonraker proxy.

Without these (or close equivalents) most of the panel will not work as shown.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
