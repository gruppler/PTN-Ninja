<template>
  <div class="hotkeys">
    <template v-for="(names, group) in names">
      <h6 v-text="$t('hotkeys.' + group)" :key="group + 'title'" />
      <q-markup-table :key="group" flat>
        <tbody>
          <tr v-for="(name, id) in names" :key="id">
            <td v-text="$t(name)" width="50%" />
            <td>
              <kbd
                v-for="(key, i) in keys[group][id].split(/ \+ /g)"
                :key="`${id}-${i}`"
                v-text="key.length > 1 ? $t('hotkeys.' + key) : key"
              />
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </template>
  </div>
</template>

<script>
import { HOTKEY_NAMES, HOTKEYS_FORMATTED } from "../keymap";

export default {
  data() {
    return {
      names: HOTKEY_NAMES,
      keys: HOTKEYS_FORMATTED
    };
  }
};
</script>
