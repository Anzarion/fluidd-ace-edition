import child_process from 'child_process'
import fs from 'fs'
import path from 'path'
import { version } from './package.json'

import type { Plugin } from 'vite'

// ACE Pro edition: emit a fork-specific version + release_info.json so Moonraker's
// update_manager tracks Anzarion/fluidd-ace-edition instead of upstream fluidd-core/fluidd.
// The base version tracks upstream (package.json, advanced on each upstream merge);
// ACE_BUILD is the fork build number, appended as a suffix.
const aceBuild = process.env.ACE_BUILD || '1'
const fullVersion = `${version}-ace.${aceBuild}`

const writeVersionFile = async () => {
  const versionFile = await fs.promises.open(path.resolve(__dirname, 'dist/.version'), 'w')

  await versionFile.writeFile(`v${fullVersion}`)

  await versionFile.close()
}

const writeReleaseInfoFile = async () => {
  const releaseInfoFile = await fs.promises.open(path.resolve(__dirname, 'dist/release_info.json'), 'w')

  await releaseInfoFile.writeFile(JSON.stringify({
    project_name: 'fluidd-ace-edition',
    project_owner: 'Anzarion',
    version: `v${fullVersion}`
  }))

  await releaseInfoFile.close()
}

const vitePluginInjectVersion = (): Plugin => {
  return {
    name: 'version',
    config: () => {
      const git_hash = child_process
        .execSync('git rev-parse --short HEAD')
        .toString()

      return {
        define: {
          'import.meta.env.VERSION': JSON.stringify(fullVersion),
          'import.meta.env.HASH': JSON.stringify(git_hash)
        }
      }
    },
    writeBundle: () => {
      setImmediate(async () => {
        await writeVersionFile()
        await writeReleaseInfoFile()
      })
    }
  }
}

export default vitePluginInjectVersion
