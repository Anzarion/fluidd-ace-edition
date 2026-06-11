<template>
  <collapsable-card
    title="ACE Pro"
    icon="$filament"
    draggable
    layout-path="dashboard.ace-pro-panel-card"
    :class="{ 'ace--narrow': narrow }"
  >
    <template #menu>
      <v-icon :color="connColor" :title="connLabel" class="mr-2">{{ connIcon }}</v-icon>
      <v-btn small text color="primary" :loading="busy" @click="resetIndex">Reset Index</v-btn>
    </template>

    <v-card-text>
      <!-- ACE selector -->
      <v-row dense class="mb-2">
        <v-col cols="12">
          <v-select
            v-model="selectedInstance"
            :items="aceOptions"
            item-text="text"
            item-value="instance"
            label="ACE"
            hide-details dense outlined
          />
        </v-col>
      </v-row>

      <!-- Device info -->
      <div class="d-flex justify-space-between text-caption text--secondary mb-3 px-1">
        <span>MODEL: <strong class="text--primary">{{ model }}</strong></span>
        <span v-if="firmware">FIRMWARE: <strong class="text--primary">{{ firmware }}</strong></span>
      </div>

      <!-- Slot grid (display 1-based, logic 0-based) -->
      <v-row dense>
        <v-col v-for="item in inventory" :key="item.slot" cols="3">
          <v-sheet
            rounded
            class="pa-3 text-center ace-slot d-flex flex-column align-center justify-center"
            :class="{ 'ace-slot--active': item.globalTool === currentTool }"
            style="cursor:pointer"
            @click="openSlot(item)"
          >
            <div class="text-caption ace-slot__top">
              <span class="text--secondary">SLOT {{ item.slot + 1 }}</span><span class="ace-slot__sep text--secondary"> · </span><span class="font-weight-bold ace-slot__status" :class="slotStatusClass(item)">{{ slotStatusLabel(item) }}</span>
            </div>
            <div class="ace-spool my-2">
              <div class="ace-spool__wound" :style="spoolWoundStyle(item)"></div>
              <div class="ace-spool__hub"></div>
              <v-chip v-if="item.rfid" x-small label color="cyan darken-3" class="ace-spool__rfid">RFID</v-chip>
            </div>
            <div class="font-weight-bold text-truncate" :class="{ 'text--disabled': !item.material }" :style="{ visibility: isEmptySlot(item) ? 'hidden' : 'visible' }">{{ slotLabel(item) }}</div>
            <div class="text-caption text--secondary text-truncate ace-slot__weight" :style="{ visibility: hasWeight(item) ? 'visible' : 'hidden' }">{{ spoolWeightLabel(item) }}</div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Filament path -->
      <div v-if="hasFilamentPath" class="ace-path mt-6 px-6">
        <div class="ace-step" :class="filamentStepClass(0)"><span class="ace-step__dot" /><span class="ace-step__label">Bowden</span></div>
        <span class="ace-step__conn" :class="{ done: stepIndex > 0 }" />
        <div class="ace-step" :class="filamentStepClass(1)"><span class="ace-step__dot" /><span class="ace-step__label">RDM</span></div>
        <span class="ace-step__conn" :class="{ done: stepIndex > 1 }" />
        <div class="ace-step" :class="filamentStepClass(2)"><span class="ace-step__dot" /><span class="ace-step__label">Toolhead</span></div>
        <span class="ace-step__conn" :class="{ done: stepIndex > 2 }" />
        <div class="ace-step" :class="filamentStepClass(3)"><span class="ace-step__dot" /><span class="ace-step__label">Nozzle</span></div>
      </div>


      <v-divider class="my-3" />

      <!-- Dryer + Manual Feed -->
      <div class="d-flex">
        <!-- Dryer -->
        <div class="flex-grow-1 pr-3" style="flex-basis:0">
          <div class="text-caption text--secondary mb-1">DRYER</div>
          <div class="d-flex align-center mb-2" style="height:44px">
            <div class="text-center mr-2 d-flex flex-column justify-center" style="flex:0 0 68px;height:44px">
              <div class="text-caption text--secondary" style="line-height:1.1">CHAMBER</div>
              <div class="text-subtitle-2 font-weight-medium" style="line-height:1.1">{{ chamberTemp }}°C</div>
            </div>
            <div class="flex-grow-1">
              <v-select v-model="dryerTemp" :items="tempOptions" label="Temp °C" hide-details dense outlined />
            </div>
          </div>
          <div class="d-flex align-center mb-2" style="height:44px">
            <div class="text-center mr-2 d-flex flex-column justify-center" style="flex:0 0 68px;height:44px">
              <template v-if="dryer.is_drying">
                <v-chip x-small label color="orange" text-color="black" class="font-weight-bold mx-auto">DRYING</v-chip>
                <div class="text-caption font-weight-bold" style="line-height:1.1">{{ remainingLabel }}</div>
              </template>
              <v-chip v-else x-small label color="blue-grey darken-1" text-color="white" class="font-weight-bold mx-auto">IDLE</v-chip>
            </div>
            <div class="flex-grow-1">
              <v-select v-model="dryerDuration" :items="durationOptions" label="Duration min" hide-details dense outlined />
            </div>
          </div>
          <v-btn v-if="dryer.is_drying" block height="40" color="red" dark :loading="busy" @click="stopDryer">STOP DRYING</v-btn>
          <v-btn v-else block height="40" color="primary" :loading="busy" @click="startDryer">START DRYING</v-btn>
        </div>

        <v-divider vertical />

        <!-- Manual Feed -->
        <div class="flex-grow-1 pl-3" style="flex-basis:0">
          <div class="text-caption text--secondary mb-1">MANUAL FEED</div>
          <div class="d-flex align-center mb-2" style="height:44px">
            <v-select v-model="feedSlot" :items="slotChoices" item-text="text" item-value="value" label="Slot" hide-details dense outlined class="flex-grow-1" />
          </div>
          <div class="d-flex align-center mb-2" style="height:44px">
            <v-row dense style="width:100%">
              <v-col cols="6"><v-text-field v-model.number="feedLength" type="number" label="mm" hide-details dense outlined /></v-col>
              <v-col cols="6"><v-text-field v-model.number="feedSpeed" type="number" label="mm/s" hide-details dense outlined /></v-col>
            </v-row>
          </div>
          <div class="d-flex align-center" style="gap:6px">
            <v-btn height="40" color="primary" :loading="busy" class="flex-grow-1" @click="move('FEED')">Feed</v-btn>
            <v-btn height="40" outlined color="red" min-width="56" @click="stopFeedRetract">Stop</v-btn>
            <v-btn height="40" color="orange darken-2" dark :loading="busy" class="flex-grow-1" @click="move('RETRACT')">Retract</v-btn>
          </div>
        </div>
      </div>

      <v-divider class="my-3" />

      <!-- Tangle Detection | Endless Spool | Spoolman -->
      <div class="d-flex">
        <!-- Tangle Detection -->
        <div class="flex-grow-1 pr-3 d-flex flex-column align-center justify-center" style="flex-basis:0">
          <v-switch :input-value="tangleDetection" label="Tangle Detection" hide-details dense class="mt-0" @change="onTangleToggle" />
        </div>

        <v-divider vertical />

        <!-- Endless Spool -->
        <div class="flex-grow-1 px-3 d-flex flex-column align-center justify-center" style="flex-basis:0">
          <v-switch v-model="endlessSpoolOn" label="Endless Spool" hide-details dense class="mt-0" />
          <v-btn-toggle v-model="endlessModeModel" dense mandatory color="primary" :disabled="!endlessSpoolOn" class="mt-2">
            <v-btn x-small value="exact">Exact</v-btn>
            <v-btn x-small value="material">Material</v-btn>
            <v-btn x-small value="next">Next</v-btn>
          </v-btn-toggle>
        </div>

        <v-divider vertical />

        <!-- Spoolman -->
        <div class="flex-grow-1 pl-3 d-flex flex-column align-center justify-center" style="flex-basis:0">
          <v-switch v-model="spoolmanSync" label="Spoolman sync" hide-details dense class="mt-0" />
        </div>
      </div>
    </v-card-text>

    <!-- Slot control dialog -->
    <app-dialog
      v-model="slotDialog"
      :title="dialogTitle"
      width="430"
      @save="saveSlot"
      @cancel="slotDialog = false"
    >
      <v-card-text v-if="dialogSlot" class="pt-4">
        <v-select
          v-model="editMaterial"
          :items="materialOptions"
          label="Material Type"
          outlined dense hide-details
          @change="onMaterialChange"
        />

        <div class="d-flex justify-space-between align-center mt-4">
          <span class="text--secondary">Print Temp</span>
          <span class="primary--text font-weight-medium">{{ editTemp }}°C</span>
        </div>
        <v-slider v-model="editTemp" :min="150" :max="320" :step="5" color="primary" hide-details />

        <v-divider class="my-3" />

        <div class="d-flex justify-center">
          <app-iro-color-picker v-model="editColorHex" :options="colorPickerOptions" />
        </div>

        <v-divider class="my-3" />

        <div class="text-caption text--secondary mb-2">HARDWARE ACTIONS</div>
        <v-row dense>
          <v-col cols="4"><v-btn block small color="primary" :loading="busy" @click="slotAction('LOAD')">Load</v-btn></v-col>
          <v-col cols="4"><v-btn block small color="orange darken-1" dark :loading="busy" @click="slotAction('PARK')">Park</v-btn></v-col>
          <v-col cols="4"><v-btn block small color="primary" outlined :loading="busy" @click="slotAction('UNLOAD_SPOOL')">Full Unload</v-btn></v-col>
        </v-row>
        <v-row dense class="mt-1">
          <v-col cols="4"><v-btn block small color="primary" :loading="busy" @click="slotAction('ASSIST')">Assist</v-btn></v-col>
          <v-col cols="4"><v-btn block small color="error" :loading="busy" @click="slotAction('DISABLE_ASSIST')">Disable</v-btn></v-col>
          <v-col cols="4"><v-btn block small text color="grey" :loading="busy" @click="clearSlot">Clear Slot</v-btn></v-col>
        </v-row>
      </v-card-text>
    </app-dialog>
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import iro from '@jaames/iro'
import aceApi from '@/components/widgets/ace/aceApi'
import { mdiPowerPlug, mdiPowerPlugOff } from '@mdi/js'

@Component({})
export default class AceProPanelCard extends Vue {
  api = aceApi
  selectedInstance = 0
  dryerTemp = 45
  dryerDuration = 120
  busy = false
  localDryers: Record<number, any> = {}

  feedSlot = 0
  feedLength = 50
  feedSpeed = 10

  spoolmanSync = true
  spoolmanState: any = {}
  // FilaMan live weights keyed by spool id; filled by refreshFilamanWeights().
  filamanWeights: Record<number, any> = {}
  filamanTimer: any = null
  // Card width (px), tracked via ResizeObserver to drive the narrow layout.
  cardWidth = 0
  resizeObs: any = null
  // Fallback tangle-detection state for setups without the driver mirror pin.
  tangleLocal = false

  slotDialog = false
  dialogSlot: any = null
  editMaterial = 'empty'
  editTemp = 220
  editColorHex = '#787878'

  // ---- reactive store reads ----
  get printerObjects (): any { return this.$store.state.printer.printer }
  get aceState (): any { return this.printerObjects.ace_state || this.printerObjects.ace || {} }
  get aceInstance (): any { return this.printerObjects[`ace_instance_${this.selectedInstance}`] || {} }
  get saveVars (): any { return this.printerObjects.save_variables?.variables || {} }

  get aceCount (): number {
    let n = 0
    while (this.printerObjects[`ace_instance_${n}`]) n++
    return n || Number(this.aceState.ace_instances) || 1
  }

  get aceOptions (): Array<{ text: string, instance: number }> {
    return Array.from({ length: this.aceCount }, (_, i) => ({ text: this.api.getAceLabel(i), instance: i }))
  }

  get currentTool (): number {
    const idx = Number(this.aceState.current_index ?? this.saveVars.ace_current_index)
    return Number.isInteger(idx) && idx >= 0 ? idx : -1
  }

  // Tangle-detection state from the driver's mirror pin; falls back to tangleLocal.
  get tangleDetection (): boolean {
    const po = this.printerObjects
    // The _-prefixed name is hidden from Fluidd's outputs list; try both.
    const pin = po['output_pin _TANGLE_DETECTION'] || po['output_pin TANGLE_DETECTION']
    if (pin && pin.value != null) return Number(pin.value) >= 0.5
    return this.tangleLocal
  }

  get inventory (): any[] {
    const n = this.api.config.slotsPerAce
    const live = Array.isArray(this.aceInstance.slots) ? this.aceInstance.slots : []
    const persistedRaw = this.api.parseMaybe(this.saveVars[`ace_inventory_${this.selectedInstance}`])
    const persisted = Array.isArray(persistedRaw) ? persistedRaw : []
    return Array.from({ length: n }, (_, slot) =>
      this.api.normalizeInventoryItem({ ...(persisted[slot] || {}), ...(live[slot] || {}) }, slot, this.selectedInstance)
    )
  }

  get dryer (): any {
    return this.api.normalizeDryer(this.aceInstance.dryer_status, this.dryerDuration, this.localDryers[this.selectedInstance])
  }

  // ---- device info ----
  get model (): string { return this.aceInstance.model || '—' }
  get firmware (): string { return this.aceInstance.firmware || '' }
  get chamberTemp (): number { return Math.round(Number(this.aceInstance.temp) || 0) }
  get hasFilamentPath (): boolean { const s = this.aceState; return s.toolhead_sensor != null || s.rdm_sensor != null || s.nozzle_sensor != null }

  get connState (): string { return String(this.aceInstance.connection_state || '').toLowerCase() }
  get connIcon (): string { return ['disconnect', 'disabled', ''].includes(this.connState) ? mdiPowerPlugOff : mdiPowerPlug }
  get connColor (): string {
    if (this.connState === 'connected') return 'green'
    if (['connecting', 'reconnecting', 'initializing'].includes(this.connState)) return 'orange'
    if (this.connState === '') return 'grey'
    return 'red'
  }

  get connLabel (): string {
    const map: Record<string, string> = {
      connected: 'Connected', connecting: 'Connecting…', reconnecting: 'Reconnecting…',
      initializing: 'Init…', disconnect: 'Disconnected', disabled: 'Off'
    }
    return map[this.connState] || (this.connState || '–')
  }


  // ---- Endless Spool (store-bound) ----
  get endlessSpoolOn (): boolean { return Boolean(this.aceState.endless_spool_enabled) }
  set endlessSpoolOn (v: boolean) {
    this.busy = true
    this.api.setEndlessSpool(v).catch(() => { /* ignore */ }).then(() => { this.busy = false })
  }

  get endlessModeModel (): string { return String(this.aceState.endless_spool_match_mode || 'exact').toLowerCase() }
  set endlessModeModel (v: string) { if (v) this.api.setEndlessSpoolMode(v).catch(() => { /* ignore */ }) }

  get tempOptions (): number[] { return this.api.getTempOptions() }
  get durationOptions (): number[] { return this.api.getDurationOptions() }
  get materialOptions (): string[] { return this.api.getMaterialOptions() }
  get aceLabel (): string { return this.api.getAceLabel(this.selectedInstance) }
  get remainingLabel (): string { return this.api.formatRemainingMinutes(this.dryer.remaining_minutes) }
  get slotChoices (): Array<{ text: string, value: number }> {
    return Array.from({ length: this.api.config.slotsPerAce }, (_, i) => ({ text: `Slot ${i + 1}`, value: i }))
  }

  get dialogTitle (): string { return this.dialogSlot ? `Slot ${this.dialogSlot.slot + 1} Control` : 'Slot' }

  get colorPickerOptions (): any {
    return {
      width: 240,
      layout: [
        { component: iro.ui.Box },
        { component: iro.ui.Slider, options: { sliderType: 'hue' } }
      ]
    }
  }

  mounted () {
    this.triggerSpoolmanSync()
    this.refreshFilamanWeights()
    // Poll FilaMan so the weight stays live as filament is consumed.
    this.filamanTimer = setInterval(() => this.refreshFilamanWeights(), 30000)
    this.measureCardWidth()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.measureCardWidth())
      this.resizeObs.observe(this.$el)
    }
  }

  beforeDestroy () {
    if (this.filamanTimer) clearInterval(this.filamanTimer)
    if (this.resizeObs) { this.resizeObs.disconnect(); this.resizeObs = null }
  }

  measureCardWidth () {
    const el = this.$el as HTMLElement
    if (el) this.cardWidth = el.clientWidth || 0
  }

  // Narrow layout for cramped columns: tiles stack instead of truncating.
  get narrow (): boolean { return this.cardWidth > 0 && this.cardWidth < 600 }

  @Watch('currentTool')
  onCurrentToolChange () { this.triggerSpoolmanSync(); this.refreshFilamanWeights() }

  // Signature of all slot spool ids; a change triggers a FilaMan refresh.
  get spoolIdSignature (): string { return this.inventory.map((i: any) => i.spoolId || 0).join(',') }

  @Watch('spoolIdSignature')
  onSpoolIdsChange () { this.refreshFilamanWeights() }

  async refreshFilamanWeights (): Promise<void> {
    const ids = Array.from(new Set(
      this.inventory.map((i: any) => i.spoolId).filter((x: any) => Number.isInteger(x) && x > 0)
    ))
    if (!ids.length) return
    const next: Record<number, any> = { ...this.filamanWeights }
    await Promise.all(ids.map(async (id: number) => {
      try {
        const spool = await this.api.fetchFilamanSpool(id)
        const remaining = spool && Number(spool.remaining_weight_g)
        if (spool && Number.isFinite(remaining)) {
          const total = Number(spool.filament && spool.filament.raw_material_weight_g) || remaining
          next[id] = { remaining, total }
        }
      } catch (_) { /* FilaMan offline / proxy error -> keep ACE fallback */ }
    }))
    this.filamanWeights = next
  }

  triggerSpoolmanSync () {
    if (this.spoolmanSync && this.currentTool >= 0) {
      this.api.syncSpoolmanActiveFromSaveVars(this.saveVars, this.spoolmanState).catch(() => { /* ignore */ })
    }
  }

  slotStatusLabel (i: any): string {
    return i.globalTool === this.currentTool ? 'ACTIVE' : String(i.status || 'empty').toUpperCase()
  }

  slotStatusClass (i: any): string {
    if (i.globalTool === this.currentTool) return 'orange--text'
    if ((i.status || '') === 'ready') return 'green--text'
    return 'text--disabled'
  }

  rgbCss (color: number[]): string {
    const c = Array.isArray(color) ? color : [120, 120, 120]
    return `rgb(${c[0]},${c[1]},${c[2]})`
  }

  // FilaMan weight entry for this slot's spool, or null (incl. empty slots).
  filamanFor (item: any): any {
    if (this.isEmptySlot(item)) return null
    const id = item && item.spoolId
    return (Number.isInteger(id) && this.filamanWeights[id]) || null
  }

  spoolCurrent (item: any): number {
    const f = this.filamanFor(item)
    return f ? Number(f.remaining) || 0 : Number(item.current) || 0
  }

  spoolTotal (item: any): number {
    const f = this.filamanFor(item)
    return f ? Number(f.total) || 0 : Number(item.total) || 0
  }

  // Coil fill ratio 0..1 from current/total; full spool when there is no live weight.
  spoolFill (item: any): number {
    const total = this.spoolTotal(item)
    const current = this.spoolCurrent(item)
    if (total > 0 && current > 0) return Math.max(0, Math.min(1, current / total))
    return 1
  }

  hasWeight (item: any): boolean { return !this.isEmptySlot(item) && this.spoolTotal(item) > 0 && this.spoolCurrent(item) > 0 }
  spoolPct (item: any): number { return Math.round(this.spoolFill(item) * 100) }
  spoolWeightLabel (item: any): string {
    const base = `${Math.round(this.spoolCurrent(item))} / ${Math.round(this.spoolTotal(item))} g`
    // Narrow column: drop the "· %" to keep it on one line.
    return this.narrow ? base : `${base} · ${this.spoolPct(item)}%`
  }

  // A slot is empty when the driver reports status 'empty' or carries no material.
  isEmptySlot (item: any): boolean {
    const m = String(item.material || '').toLowerCase()
    return item.status === 'empty' || m === '' || m === 'empty'
  }

  // Coil color, with a grey fallback when none is set.
  spoolColor (item: any): number[] {
    return Array.isArray(item.color) ? item.color : [120, 120, 120]
  }

  spoolWoundStyle (item: any): Record<string, string> {
    if (this.isEmptySlot(item)) return { display: 'none' }
    const c = this.spoolColor(item)
    const HUB = 18
    const MAX = 68
    const d = HUB + (MAX - HUB) * this.spoolFill(item)
    // Lift near-black colors so the coil stays visible; bright colors are untouched.
    const lift = Math.max(0, 42 - Math.max(c[0], c[1], c[2]))
    const light = `rgb(${Math.round(c[0] + lift)},${Math.round(c[1] + lift)},${Math.round(c[2] + lift)})`
    const dark = `rgb(${Math.round(c[0] * 0.55)},${Math.round(c[1] * 0.55)},${Math.round(c[2] * 0.55)})`
    return {
      width: `${d}px`,
      height: `${d}px`,
      background: `repeating-radial-gradient(circle, ${light} 0 1.7px, ${dark} 1.7px 3.4px)`
    }
  }

  // Name line: "<custom name> · <material>", or just the material.
  slotLabel (item: any): string {
    if (!item.material) return '---'
    return item.custom_name ? `${item.custom_name} · ${item.material}` : item.material
  }

  // Filament tip position = the furthest-triggered path sensor.
  get stepIndex (): number {
    const s = this.aceState
    if (s.nozzle_sensor) return 3
    if (s.toolhead_sensor) return 2
    if (s.rdm_sensor) return 1
    // No path sensor triggered: Bowden if any slot still holds filament, else idle.
    return this.inventory.some(item => !this.isEmptySlot(item)) ? 0 : -1
  }

  filamentStepClass (i: number): string {
    if (i < this.stepIndex) return 'done'
    if (i === this.stepIndex) return 'cur'
    return ''
  }

  rgbToHex (color: number[]): string {
    const c = Array.isArray(color) ? color : [120, 120, 120]
    return '#' + c.slice(0, 3).map((n) => Math.max(0, Math.min(255, Number(n) || 0)).toString(16).padStart(2, '0')).join('')
  }

  hexToRgb (hex: string): number[] {
    const h = String(hex || '').replace('#', '').slice(0, 6).padEnd(6, '0')
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) || 0)
  }

  openSlot (item: any) {
    this.dialogSlot = item
    this.editMaterial = item.material || 'empty'
    this.editTemp = Number(item.temp) || this.api.getMaterialDefaultTemp(item.material)
    this.editColorHex = this.rgbToHex(item.color)
    this.slotDialog = true
  }

  onMaterialChange () { this.editTemp = this.api.getMaterialDefaultTemp(this.editMaterial) }

  async slotAction (action: string) {
    if (!this.dialogSlot) return
    this.busy = true
    try { await this.api.runSlotAction(action, this.selectedInstance, this.dialogSlot.slot) } finally { this.busy = false }
  }

  async saveSlot () {
    if (!this.dialogSlot) return
    this.busy = true
    try {
      await this.api.saveSlot(this.selectedInstance, this.dialogSlot.slot, this.editMaterial, this.editTemp, this.hexToRgb(this.editColorHex))
      this.slotDialog = false
    } finally { this.busy = false }
  }

  async clearSlot () {
    if (!this.dialogSlot) return
    this.busy = true
    try { await this.api.clearSlot(this.selectedInstance, this.dialogSlot.slot); this.slotDialog = false } finally { this.busy = false }
  }

  async startDryer () {
    this.busy = true
    try { await this.api.startDryer(this.selectedInstance, this.dryerTemp, this.dryerDuration, this.localDryers) } finally { this.busy = false }
  }

  async stopDryer () {
    this.busy = true
    try { await this.api.stopDryer(this.selectedInstance, this.localDryers) } finally { this.busy = false }
  }

  async move (type: string) {
    this.busy = true
    try { await this.api.executeMove(type, this.selectedInstance, this.feedSlot, this.feedLength, this.feedSpeed) } finally { this.busy = false }
  }

  // Stop whichever motion is running (feed or retract).
  async stopFeedRetract () {
    try { await this.api.stopMove('FEED', this.selectedInstance, this.feedSlot) } catch (_) { /* ignore */ }
    try { await this.api.stopMove('RETRACT', this.selectedInstance, this.feedSlot) } catch (_) { /* ignore */ }
  }

  onTangleToggle (v: boolean) {
    this.tangleLocal = v
    this.api.setTangleDetection(v).catch(() => { /* ignore */ })
  }

  async resetIndex () {
    this.busy = true
    try { await this.api.resetActiveToolhead(this.selectedInstance) } finally { this.busy = false }
  }
}
</script>

<style scoped>
.ace-slot { position: relative; height: 100%; min-height: 176px; border: 1px solid rgba(127, 127, 127, 0.25); transition: border-color .15s; }
.ace-slot__top { position: relative; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Keep text lines single-line so tiles stay equal height. */
.ace-slot .text-truncate { max-width: 100%; }
/* Narrow layout: stack the status under the slot number, top-align tile content. */
.ace--narrow .ace-slot { justify-content: flex-start !important; }
.ace--narrow .ace-slot__top { white-space: normal; overflow: visible; text-overflow: clip; }
.ace--narrow .ace-slot__sep { display: none; }
.ace--narrow .ace-slot__status { display: block; }
/* RFID badge overlaid on the spool. */
.ace-spool__rfid { position: absolute; right: -6px; top: 50%; transform: translateY(-50%); z-index: 2; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6); }
.ace-slot:hover { border-color: rgba(127, 127, 127, 0.5); }
.ace-slot--active {
  border: 2px solid #ff9800 !important;
  background: rgba(255, 152, 0, 0.12) !important;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.35);
}
/* Interactive spool */
.ace-spool {
  width: 84px; height: 84px; border-radius: 50%; position: relative; margin: 0 auto; flex: none;
  /* flange + 4 holes around the circumference */
  background:
    radial-gradient(circle 3px at 50% 5%, #0d0d0d 95%, transparent),
    radial-gradient(circle 3px at 95% 50%, #0d0d0d 95%, transparent),
    radial-gradient(circle 3px at 50% 95%, #0d0d0d 95%, transparent),
    radial-gradient(circle 3px at 5% 50%, #0d0d0d 95%, transparent),
    radial-gradient(circle, #333 0%, #262626 70%, #202020 100%);
  border: 1px solid #484848;
  box-shadow: inset 0 0 9px rgba(0, 0, 0, 0.55);
}
.ace-spool__wound, .ace-spool__hub {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 50%;
}
.ace-spool__wound { transition: width 0.4s ease, height 0.4s ease; }
.ace-spool__hub {
  width: 20px; height: 20px; background: #1c1c1c; border: 2px solid #555;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.8);
}

/* Filament path stepper */
.ace-path { display: flex; align-items: center; }
.ace-step { display: flex; flex-direction: column; align-items: center; }
.ace-step__dot { width: 16px; height: 16px; border-radius: 50%; background: #3a3a3a; border: 2px solid #555; }
.ace-step.done .ace-step__dot { background: var(--v-primary-base, #26c6da); border-color: var(--v-primary-base, #26c6da); }
.ace-step.cur .ace-step__dot { background: #ff9800; border-color: #ff9800; box-shadow: 0 0 9px rgba(255, 152, 0, 0.6); }
.ace-step__label { font-size: 12px; color: #9a9a9a; margin-top: 6px; }
.ace-step.cur .ace-step__label { color: #ff9800; font-weight: 700; }
.ace-step__conn { flex: 1; height: 3px; background: #444; margin-bottom: 24px; }
.ace-step__conn.done { background: var(--v-primary-base, #26c6da); }
</style>
