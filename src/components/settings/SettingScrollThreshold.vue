<template>
  <q-item :disable="disable">
    <q-item-section>
      <q-item-label class="text-no-wrap">
        {{ $t(entry.label) }}
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-input
        :value="value"
        @input="set"
        type="number"
        :min="0"
        :max="999"
        :disable="disable"
        suffix="px"
        clearable
        filled
        dense
      >
        <template v-slot:before>
          <q-btn
            @click="dialogAutodetect = true"
            :disable="disable"
            icon="autofix"
            flat
            dense
          >
            <hint>{{ $t("Autodetect") }}</hint>
          </q-btn>
        </template>
      </q-input>
    </q-item-section>

    <q-dialog @wheel="autodetect" v-model="dialogAutodetect">
      <q-card class="non-selectable">
        <q-card-section class="q-py-xl">
          {{ $t("hint.autodetectScroll") }}
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-item>
</template>

<script>
import { getValue, setValue } from "../../settings/registry";
import { wheelDeltaY } from "../../utilities";

export default {
  name: "SettingScrollThreshold",
  props: {
    entry: { type: Object, required: true },
    disable: Boolean,
  },
  data() {
    return {
      dialogAutodetect: false,
    };
  },
  computed: {
    value() {
      return getValue(this.$store.state, this.entry);
    },
  },
  methods: {
    // An empty or sub-pixel threshold means "use the default", stored as 0
    set(value) {
      const number = parseFloat(value);
      setValue(
        this.$store.dispatch,
        this.entry,
        !number || number < 1 ? 0 : number
      );
    },
    autodetect(event) {
      // Measured the same way the wheel handlers count it
      this.set(Math.abs(wheelDeltaY(event)));
      this.dialogAutodetect = false;
    },
  },
};
</script>
