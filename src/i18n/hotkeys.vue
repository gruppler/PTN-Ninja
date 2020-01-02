<template>
  <div class="hotkeys">
    <template v-for="(names, group) in filtered.names">
      <h6 v-text="$t('hotkeys.' + group)" :key="group + 'title'" />
      <q-markup-table :key="group" flat>
        <tbody>
          <tr v-for="(name, id) in names" :key="id">
            <td v-text="$t(name)" width="50%" />
            <td>
              <kbd
                v-for="(key, i) in filtered.keys[group][id]"
                :key="`${id}-${i}`"
                v-text="key"
              />
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </template>
  </div>
</template>

<script>
import { HOTKEYS, HOTKEYS_FORMATTED, HOTKEY_NAMES } from "../keymap";

import { pick, pickBy, zipObject } from "lodash";

export default {
  props: ["value"],
  data() {
    return {
      names: HOTKEY_NAMES,
      keys: zipObject(
        Object.keys(HOTKEYS_FORMATTED),
        Object.values(HOTKEYS_FORMATTED).map(values => {
          return zipObject(
            Object.keys(values),
            Object.values(values).map(value =>
              value
                .split(/ \+ /g)
                .map(key => (key.length > 1 ? this.$t("hotkeys." + key) : key))
            )
          );
        })
      )
    };
  },
  computed: {
    filtered() {
      if (this.value) {
        const q = this.value.toLowerCase();

        const search = (category, key) => {
          return (
            this.$t("hotkeys." + category)
              .toLowerCase()
              .includes(q) ||
            (this.$t(this.names[category][key])
              .toLowerCase()
              .includes(q) ||
              this.keys[category][key].find(key =>
                ("" + key).toLowerCase().includes(q)
              ) ||
              HOTKEYS[category][key].find(key =>
                ("" + key).toLowerCase().includes(q)
              ))
          );
        };

        const filteredKeys = pickBy(
          zipObject(
            Object.keys(this.names),
            Object.keys(this.names).map(category => {
              return Object.keys(this.names[category]).filter(key => {
                return search(category, key);
              });
            })
          ),
          values => values.length
        );

        return {
          names: zipObject(
            Object.keys(filteredKeys),
            Object.keys(filteredKeys).map(category =>
              pick(this.names[category], filteredKeys[category])
            )
          ),
          keys: zipObject(
            Object.keys(filteredKeys),
            Object.keys(filteredKeys).map(category =>
              pick(this.keys[category], filteredKeys[category])
            )
          )
        };
      } else {
        return { names: this.names, keys: this.keys };
      }
    }
  }
};
</script>
