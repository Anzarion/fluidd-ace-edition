// ACE Pro – native Fluidd integration: data/transport layer.

const CONFIG = {
  aceLabelPrefix: 'ACE',
  slotsPerAce: 4,
  defaultAceCount: 1,
  tempOptions: [30, 35, 40, 45, 50, 55, 60],
  durationOptions: [30, 60, 90, 120, 150, 180, 210, 240],
  materialOptions: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'NYLON', 'PC', 'empty'],
  materialDefaults: {
    PLA: 220,
    'PLA+': 210,
    PETG: 250,
    ABS: 250,
    ASA: 260,
    TPU: 230,
    NYLON: 250,
    PC: 280,
    empty: 0
  },
  endpoints: {
    objectQuery: '/printer/objects/query',
    gcodeScript: '/printer/gcode/script',
    aceStatus: '/server/ace/status',
    filamanProxy: '/server/filaman/proxy'
  }
}

// Dynamic glue to Moonraker/ACE: the typed boundary is the panel, so the api
// object itself is intentionally loosely typed (any) - it shovels JSON payloads.
const api: any = {
  config: CONFIG,

  getConfig () { return JSON.parse(JSON.stringify(CONFIG)) },
  getTempOptions () { return [...CONFIG.tempOptions] },
  getDurationOptions () { return [...CONFIG.durationOptions] },
  getMaterialOptions () { return [...CONFIG.materialOptions] },
  getMaterialDefaultTemp (material: any) {
    const key = String(material || '')
    const md = CONFIG.materialDefaults as Record<string, number>
    return md[key.toUpperCase()] ?? md[key] ?? 220
  },
  getAceLabel (instance: number) { return `${CONFIG.aceLabelPrefix} ${(Number(instance) || 0) + 1}` },
  getAceValue (instance: number) { return `ace${(Number(instance) || 0) + 1}` },

  async request (path: string, options: RequestInit = {}) {
    const response = await fetch(path, options)
    if (!response.ok) throw new Error(`ACE_UI request failed ${response.status}: ${path}`)
    try { return await response.json() } catch { return {} }
  },

  async queryObjects (extraObjects: string[] = []) {
    const objects = [
      'save_variables', 'ace',
      'temperature_sensor ace_temp_0', 'temperature_sensor ace_temp_1',
      'temperature_sensor ace_temp_2', 'temperature_sensor ace_temp_3',
      ...extraObjects
    ]
    const seen = new Set()
    const query = objects
      .filter((name) => { const k = String(name); if (seen.has(k)) return false; seen.add(k); return true })
      .map((name) => encodeURIComponent(name))
      .join('&')
    return this.request(`${CONFIG.endpoints.objectQuery}?${query}`)
  },

  async sendGcode (script: string) {
    return this.request(CONFIG.endpoints.gcodeScript, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    })
  },

  async getAceStatus (instance: number) {
    return this.request(`${CONFIG.endpoints.aceStatus}?instance=${Number(instance) || 0}`)
  },

  async fetchStatusSnapshot (instance: number = 0, extraObjects: string[] = []) {
    const selectedInstance = Number(instance) || 0
    const [objectsPayload, acePayload] = await Promise.allSettled([
      this.queryObjects(extraObjects),
      this.getAceStatus(selectedInstance)
    ])
    const objects = objectsPayload.status === 'fulfilled' ? objectsPayload.value : {}
    const remote = acePayload.status === 'fulfilled' ? acePayload.value : null
    const saveVars = this.getSaveVariables(objects)
    return {
      instance: selectedInstance,
      objects,
      remote,
      status: this.normalizeResult(objects)?.status || {},
      saveVars,
      remoteStatus: remote ? this.normalizeResult(remote) : null,
      inventoryInfo: this.getInventoryInfo(saveVars),
      selectedInventory: this.getInventoryForInstance(saveVars, selectedInstance)
    }
  },

  normalizeResult (payload: any) { return payload && payload.result ? payload.result : payload },
  getSaveVariables (payload: any) {
    const status = this.normalizeResult(payload)?.status || {}
    return status.save_variables?.variables || {}
  },

  // Parse a Klipper save_variables value (JSON or Python repr); raw value on failure.
  parseMaybe (value: any) {
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch {}
    try {
      const normalized = value
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/'/g, '"')
      return JSON.parse(normalized)
    } catch { return value }
  },

  getInventoryKeys (saveVars: any) {
    return Object.keys(saveVars || {})
      .filter((key) => /^ace_inventory_\d+$/.test(key))
      .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
  },

  getAceOptions (saveVars: any) {
    const keys = this.getInventoryKeys(saveVars)
    if (keys.length > 0) {
      return keys.map((key: string) => {
        const idx = Number(key.split('_').pop())
        return { text: this.getAceLabel(idx), value: this.getAceValue(idx), instance: idx, key }
      })
    }
    return [{ text: this.getAceLabel(0), value: this.getAceValue(0), instance: 0, key: 'ace_inventory_0' }]
  },

  normalizeColor (color: any) {
    if (Array.isArray(color)) return color.slice(0, 3).map((v) => Math.max(0, Math.min(255, Number(v) || 0)))
    if (typeof color === 'string') {
      const parts = color.split(',').map((v: string) => Number(v.trim()))
      if (parts.length >= 3 && parts.every((v: number) => Number.isFinite(v))) {
        return parts.slice(0, 3).map((v: number) => Math.max(0, Math.min(255, v)))
      }
    }
    return [120, 120, 120]
  },

  // Spool id from a SKU: a whole-numeric SKU, or the trailing segment of VENDOR-MATERIAL-SPOOLID.
  parseSpoolId (sku: any) {
    const s = String(sku == null ? '' : sku).trim()
    if (/^\d+$/.test(s)) return Number(s)
    const tail = s.split('-').pop()
    return tail && /^\d+$/.test(tail) ? Number(tail) : null
  },

  normalizeInventoryItem (item: any, slot = 0, instance = 0) {
    const src = item && typeof item === 'object' ? item : {}
    const material = src.material || src.type || 'empty'
    const sku = src.sku != null ? String(src.sku).trim() : ''
    return {
      ...src,
      instance,
      slot,
      globalTool: instance * CONFIG.slotsPerAce + slot,
      status: src.status || 'empty',
      material,
      type: src.type || material,
      temp: Number(src.temp || src.print_temp || src.temperature || 0),
      color: this.normalizeColor(src.color),
      sku,
      spoolId: this.parseSpoolId(sku),
      brand: src.brand || '',
      rfid: Boolean(src.rfid)
    }
  },

  getInventoryForInstance (saveVars: any, instance = 0) {
    const idx = Number(instance) || 0
    let raw = this.parseMaybe(saveVars?.[`ace_inventory_${idx}`])
    if (!Array.isArray(raw) && idx === 0) raw = this.parseMaybe(saveVars?.ace_inventory)
    if (!Array.isArray(raw)) raw = []
    return Array.from({ length: CONFIG.slotsPerAce }, (_, slot) => this.normalizeInventoryItem(raw[slot], slot, idx))
  },

  getAllInventories (saveVars: any) {
    return this.getAceOptions(saveVars).map((opt: any) => ({
      ...opt,
      inventory: this.getInventoryForInstance(saveVars, opt.instance)
    }))
  },

  getCurrentTool (saveVars: any) {
    const idx = Number(saveVars?.ace_current_index)
    return Number.isInteger(idx) && idx >= 0 ? idx : -1
  },

  getToolMapping (globalTool: number) {
    const tool = Number(globalTool)
    if (!Number.isInteger(tool) || tool < 0) return { tool: -1, instance: -1, slot: -1 }
    return { tool, instance: Math.floor(tool / CONFIG.slotsPerAce), slot: tool % CONFIG.slotsPerAce }
  },

  getCurrentToolInfo (saveVars: any) {
    const tool = this.getCurrentTool(saveVars)
    const map = this.getToolMapping(tool)
    if (tool < 0) return { tool: -1, instance: -1, slot: -1, item: null }
    const inv = this.getInventoryForInstance(saveVars, map.instance)
    return { ...map, item: inv[map.slot] || null }
  },

  getInventoryInfo (saveVars: any) {
    const aceOptions = this.getAceOptions(saveVars)
    const current = this.getCurrentToolInfo(saveVars)
    return {
      aceCount: aceOptions.length,
      aceOptions,
      inventories: this.getAllInventories(saveVars),
      currentTool: current.tool,
      current
    }
  },

  getSpoolIdForTool (saveVars: any, globalTool: number) {
    const { instance, slot } = this.getToolMapping(globalTool)
    if (instance < 0 || slot < 0) return null
    return this.getInventoryForInstance(saveVars, instance)[slot]?.spoolId || null
  },

  // Fetch one FilaMan spool via the Moonraker proxy. Returns the spool object or null.
  async fetchFilamanSpool (spoolId: any) {
    const id = Number(spoolId)
    if (!Number.isInteger(id) || id <= 0) return null
    const payload = await this.request(CONFIG.endpoints.filamanProxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_method: 'GET', path: `/api/v1/spools/${id}` })
    })
    return this.normalizeResult(payload)
  },

  // Set Spoolman's active spool from the current tool. Returns { changed }.
  async syncSpoolmanActiveFromSaveVars (saveVars: any, state: any = {}) {
    const current = this.getCurrentTool(saveVars)
    if (!Number.isInteger(current) || current < 0) return { changed: false, reason: 'no-active-tool', state }
    const spoolId = this.getSpoolIdForTool(saveVars, current)
    if (!spoolId) return { changed: false, reason: 'no-valid-sku', tool: current, state }
    const sku = String(spoolId)
    if (state.lastSpoolmanIndex === current && String(state.lastSpoolmanSku) === sku) {
      return { changed: false, reason: 'already-synced', tool: current, spoolId, state }
    }
    await this.sendGcode(`SET_ACTIVE_SPOOL ID=${spoolId}`)
    state.lastSpoolmanIndex = current
    state.lastSpoolmanSku = sku
    return { changed: true, tool: current, spoolId, state }
  },

  async startDryer (instance: number, temp: number, duration: number, localDryers: any) {
    const aceInstance = Number(instance) || 0
    const target = Number(temp)
    const minutes = Number(duration)
    await this.sendGcode(`ACE_START_DRYING INSTANCE=${aceInstance} TEMP=${target} DURATION=${minutes}`)
    if (localDryers && Number.isFinite(minutes) && minutes > 0) {
      localDryers[aceInstance] = { end_time: Date.now() + 60 * minutes * 1000 }
    }
    return { instance: aceInstance, temp: target, duration: minutes, started: true }
  },

  async stopDryer (instance: number, localDryers: any) {
    const aceInstance = Number(instance) || 0
    await this.sendGcode(`ACE_STOP_DRYING INSTANCE=${aceInstance}`)
    if (localDryers) delete localDryers[aceInstance]
    return { instance: aceInstance, stopped: true }
  },

  async runSlotAction (action: string, instance: number, slot: number) {
    const aceInstance = Number(instance) || 0
    const index = Number(slot) || 0
    const tool = aceInstance * CONFIG.slotsPerAce + index
    const commands: Record<string, string> = {
      LOAD: `ACE_CHANGE_TOOL TOOL=${tool}`,
      PARK: `ACE_SMART_UNLOAD TOOL=${tool}`,
      UNLOAD_SPOOL: `ACE_FULL_UNLOAD TOOL=${tool}`,
      ASSIST: `ACE_ENABLE_FEED_ASSIST INSTANCE=${aceInstance} INDEX=${index}`,
      DISABLE_ASSIST: `ACE_DISABLE_FEED_ASSIST INSTANCE=${aceInstance} INDEX=${index}`
    }
    const gcode = commands[action]
    if (!gcode) return { action, ignored: true }
    await this.sendGcode(gcode)
    return { action, instance: aceInstance, slot: index, tool, script: gcode }
  },

  async executeMove (type: string, instance: number, slot: number, length: number, speed: number) {
    const aceInstance = Number(instance) || 0
    const index = Number(slot) || 0
    const command = type === 'FEED' ? 'ACE_FEED' : 'ACE_RETRACT'
    const gcode = `${command} INSTANCE=${aceInstance} INDEX=${index} LENGTH=${Number(length)} SPEED=${Number(speed)}`
    await this.sendGcode(gcode)
    return { type, instance: aceInstance, slot: index, length: Number(length), speed: Number(speed), script: gcode }
  },

  async stopMove (type: string, instance: number, slot: number) {
    const aceInstance = Number(instance) || 0
    const index = Number(slot) || 0
    const cmd = type === 'FEED' ? 'ACE_STOP_FEED' : 'ACE_STOP_RETRACT'
    await this.sendGcode(`${cmd} INSTANCE=${aceInstance} INDEX=${index}`)
    return { type, instance: aceInstance, slot: index }
  },

  async smartLoadAll () {
    await this.sendGcode('ACE_SMART_LOAD')
    return { smartLoad: true }
  },

  async resetActiveToolhead (instance: number) {
    const aceInstance = Number(instance) || 0
    await this.sendGcode(`ACE_RESET_ACTIVE_TOOLHEAD INSTANCE=${aceInstance}`)
    return { instance: aceInstance }
  },

  async clearSlot (instance: number, slot: number) {
    const aceInstance = Number(instance) || 0
    const index = Number(slot) || 0
    await this.sendGcode(`ACE_SET_SLOT INSTANCE=${aceInstance} INDEX=${index} EMPTY=1`)
    return { instance: aceInstance, slot: index, empty: true }
  },

  async setEndlessSpool (enabled: boolean) {
    await this.sendGcode(enabled ? 'ACE_ENABLE_ENDLESS_SPOOL' : 'ACE_DISABLE_ENDLESS_SPOOL')
    return { enabled: !!enabled }
  },

  async setEndlessSpoolMode (mode: string) {
    const valid = ['exact', 'material', 'next']
    const safe = valid.includes(String(mode).toLowerCase()) ? String(mode).toLowerCase() : 'exact'
    await this.sendGcode(`ACE_SET_ENDLESS_SPOOL_MODE MODE=${safe}`)
    return { mode: safe }
  },

  async setTangleDetection (enabled: boolean) {
    await this.sendGcode(`ACE_TANGLE_DETECTION ENABLE=${enabled ? 1 : 0}`)
    return { enabled: !!enabled }
  },

  normalizeRgb (rgb: any) {
    if (Array.isArray(rgb)) return rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, Number(v) || 0))).join(',')
    if (rgb && typeof rgb === 'object') return [rgb.r, rgb.g, rgb.b].map((v) => Math.max(0, Math.min(255, Number(v) || 0))).join(',')
    return String(rgb || '0,0,0').replace(/^"|"$/g, '')
  },

  // MATERIAL is clamped to the known option set (g-code injection guard).
  async saveSlot (instance: number, slot: number, material: any, temp: number, rgb: any) {
    const aceInstance = Number(instance) || 0
    const index = Number(slot) || 0
    const color = this.normalizeRgb(rgb)
    const candidate = String(material || 'empty').toUpperCase()
    const safeMaterial = CONFIG.materialOptions.includes(candidate) ? candidate : 'empty'
    const gcode = `ACE_SET_SLOT INSTANCE=${aceInstance} INDEX=${index} MATERIAL=${safeMaterial} TEMP=${Number(temp)} COLOR="${color}"`
    await this.sendGcode(gcode)
    return { instance: aceInstance, slot: index, material: safeMaterial, temp: Number(temp), color, script: gcode }
  },

  // Normalize the dryer object; remain_time is in seconds. localDryer is a
  // client-side fallback used when the unit reports a stopped dryer.
  normalizeDryer (raw: any, selectedDuration: number = 0, localDryer: any = null) {
    let dryer = raw && typeof raw === 'object' ? { ...raw } : { status: 'stop', remain_time: 0 }
    if ((dryer.status === 'stop' || dryer.status === undefined) && localDryer?.end_time) {
      const fallbackSeconds = Math.max(0, Math.floor((localDryer.end_time - Date.now()) / 1000))
      if (fallbackSeconds > 0) dryer = { status: 'drying', remain_time: fallbackSeconds }
    }
    const remainSeconds = Number(dryer.remain_time ?? dryer.remaining_time ?? 0)
    return {
      ...dryer,
      status: dryer.status || 'stop',
      target_temp: Number(dryer.target_temp ?? 0),
      duration: Number(dryer.duration ?? selectedDuration ?? 0),
      remain_seconds: remainSeconds,
      remaining_minutes: remainSeconds / 60,
      is_drying: dryer.status !== 'stop' && dryer.status !== undefined
    }
  },

  formatRemainingMinutes (minutes: number) {
    const value = Math.max(0, Math.floor(Number(minutes) || 0))
    const hours = Math.floor(value / 60)
    const mins = value % 60
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`
  }
}

export default api
