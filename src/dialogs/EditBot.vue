<template>
  <large-dialog ref="dialog" :value="Boolean(bot)" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="bot" :title="$t(isNew ? 'New Bot' : 'Edit Bot')" />
    </template>

    <q-list v-if="buffer">
      <q-form ref="form" @submit="submit" greedy>
        <!-- Meta -->

        <!-- Name -->
        <q-input
          v-model="buffer.meta.name"
          :label="$t('Name')"
          :rules="[(a) => a && a.trim().length > 0]"
          hide-bottom-space
          filled
          item-aligned
        />
        <!-- Author -->
        <q-input
          v-model="buffer.meta.author"
          :label="$t('Author')"
          filled
          item-aligned
        />
        <!-- Version -->
        <q-input
          v-model="buffer.meta.version"
          :label="$t('Version')"
          filled
          item-aligned
        />

        <q-separator />
        <!-- Connection Settings -->
        <q-item-label header>{{ $t("Connection Settings") }}</q-item-label>
        <!-- Address -->
        <q-input
          v-model.number="buffer.meta.connection.address"
          :label="$t('tei.address')"
          :prefix="bot.protocol"
          filled
          item-aligned
        >
          <template v-slot:after>
            <!-- Port -->
            <q-input
              v-model.number="buffer.meta.connection.port"
              :label="$t('tei.port')"
              style="width: 9em"
              type="number"
              min="0"
              max="65535"
              step="1"
              prefix=":"
              filled
            />
          </template>
        </q-input>

        <!-- Use SSL -->
        <q-item tag="label" clickable v-ripple>
          <q-item-section side>
            <q-toggle v-model="buffer.meta.connection.ssl" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator />
        <!-- Limit Types -->
        <q-item-label header>{{ $tc("analysis.limitTypes", 0) }}</q-item-label>
        <q-item v-for="type in allLimitTypes" :key="type.value">
          <q-item-section side>
            <div class="self-center">{{ type.label }}</div>
            <q-toggle v-model="limitTypes" :val="type.value" />
          </q-item-section>
          <q-item-section>
            <q-input
              :label="$t('analysis.min')"
              type="number"
              v-model.number="buffer.meta.limitTypes[type.value].min"
              :suffix="type.suffix"
              :min="1"
              :max="1e9"
              :disable="!limitTypes.includes(type.value)"
              filled
            />
          </q-item-section>
          <q-item-section>
            <q-input
              :label="$t('analysis.max')"
              type="number"
              v-model.number="buffer.meta.limitTypes[type.value].max"
              :suffix="type.suffix"
              :min="1"
              :max="1e9"
              :disable="!limitTypes.includes(type.value)"
              filled
            />
          </q-item-section>
          <q-item-section>
            <q-input
              :label="$t('analysis.step')"
              type="number"
              v-model.number="buffer.meta.limitTypes[type.value].step"
              :suffix="type.suffix"
              :min="1"
              :max="1e9"
              :disable="!limitTypes.includes(type.value)"
              filled
            />
          </q-item-section>
        </q-item>

        <!-- Interactive Analysis -->
        <q-item tag="label" clickable v-ripple>
          <q-item-section side>
            <q-toggle v-model="buffer.meta.isInteractive" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{
              $t("analysis.interactiveAnalysis")
            }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator />
        <!-- Size/Komi -->
        <q-item-label header>{{ $t("analysis.sizeHalfKomi") }}</q-item-label>
        <q-select
          v-for="size in allSizes"
          :key="size"
          v-model="buffer.meta.sizeHalfKomis[size]"
          :options="halfKomis"
          :disable="!sizes.includes(size)"
          behavior="menu"
          transition-show="none"
          transition-hide="none"
          hide-dropdown-icon
          multiple
          use-chips
          filled
          item-aligned
        >
          <template v-if="sizes.includes(size)" v-slot:append>
            <q-icon
              name="invert"
              @click.capture.stop.prevent="invertKomi(size)"
              class="q-field__focusable-action"
              right
            />
            <q-icon
              name="copy"
              @click.capture.stop.prevent="copyKomi(size)"
              class="q-field__focusable-action"
              right
            />
          </template>
          <template v-slot:before>
            <div class="column justify-center text-center text-body2">
              {{ size }}x{{ size }}
              <q-toggle v-model="sizes" :val="size" @input="toggleSize(size)" />
            </div>
          </template>
        </q-select>

        <q-separator />
        <!-- Formatting -->
        <q-item tag="label" clickable v-ripple>
          <q-item-section side>
            <q-toggle v-model="buffer.meta.normalizeEvaluation" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{
              $t("analysis.normalizeEvaluation")
            }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-input
          type="number"
          v-model.number="buffer.meta.sigma"
          :disable="!buffer.meta.normalizeEvaluation"
          :label="$t('analysis.sigma')"
          :min="1"
          :max="1e4"
          :rules="[(s) => s > 0]"
          hide-bottom-space
          filled
          item-aligned
        />

        <div v-if="Object.keys(buffer.meta.presetOptions).length" class="bg-ui">
          <q-separator />
          <!-- Bot Options -->
          <q-item-label header>{{
            $t("analysis.Preset Bot Options")
          }}</q-item-label>
          <BotOptionInput
            v-for="(option, name) in buffer.meta.presetOptions"
            :key="name"
            v-model="buffer.meta.presetOptions[name].value"
            :disable="!options.includes(name)"
            :option="option"
            :name="name"
            filled
            item-aligned
          >
            <template v-slot:before>
              <q-toggle v-model="options" :val="name" />
            </template>
          </BotOptionInput>
        </div>
      </q-form>
    </q-list>

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" content-class="q-mt-md q-mx-md" />

      <q-card-actions align="right">
        <q-btn
          :label="$t('Delete')"
          @click="deleteBot()"
          color="primary"
          flat
        />
        <q-space />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('Save')"
          @click="$refs.form.submit()"
          color="primary"
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import BotOptionInput from "../components/analysis/BotOptionInput";

import { uid } from "quasar";
import { cloneDeep, difference, forEach, isEqual, omit, pick } from "lodash";
import { defaultLimitTypes } from "../bots/bot";

const halfKomis = [];
for (let k = -9; k <= 9; k++) {
  halfKomis.push(k);
}

export default {
  name: "EditBot",
  components: { BotOptionInput },
  data() {
    return {
      buffer: null,
      error: "",
      allSizes: [3, 4, 5, 6, 7, 8],
      limitTypes: [],
      sizes: [],
      options: [],
      halfKomis,
    };
  },
  computed: {
    bot() {
      return this.$store.getters["analysis/bot"];
    },
    botMeta() {
      return this.$store.state.analysis.botMeta;
    },
    botState() {
      return this.$store.state.analysis.botState;
    },
    isNew() {
      return !this.bot || !this.botMeta.isCustom;
    },
    allLimitTypes() {
      return [
        { label: this.$t("analysis.Depth"), value: "depth" },
        { label: this.$t("analysis.Nodes"), value: "nodes" },
        { label: this.$t("Time"), value: "movetime", suffix: "ms" },
      ];
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    copyKomi(size) {
      size = size.toString();
      const halfKomis = this.buffer.meta.sizeHalfKomis[size] || [];
      this.sizes.forEach((s) => {
        if (s !== size) {
          this.buffer.meta.sizeHalfKomis[s] = [...halfKomis];
        }
      });
    },
    invertKomi(size) {
      this.buffer.meta.sizeHalfKomis[size] = difference(
        halfKomis,
        this.buffer.meta.sizeHalfKomis[size]
      );
    },
    toggleSize(size) {
      if (!this.sizes.includes(size)) {
        this.buffer.meta.sizeHalfKomis[size] = [];
      }
    },
    reset() {
      if (this.isNew && !this.botState.isConnected) {
        this.close();
      }
      const buffer = {
        id: this.isNew ? uid() : this.bot.id,
        meta: pick(cloneDeep(this.botMeta), [
          "name",
          "author",
          "version",
          "connection",
          "isInteractive",
          "normalizeEvaluation",
          "sigma",
          "sizeHalfKomis",
          "limitTypes",
        ]),
      };

      // Connection
      if (this.isNew) {
        buffer.meta.connection = pick(this.bot.settings, [
          "address",
          "port",
          "ssl",
        ]);
        buffer.meta.normalizeEvaluation = this.bot.settings.normalizeEvaluation;
        buffer.meta.sigma = this.bot.settings.sigma;
      }

      // Limit Types
      this.limitTypes = Object.keys(buffer.meta.limitTypes);
      forEach(defaultLimitTypes, (params, type) => {
        if (!(type in buffer.meta.limitTypes)) {
          buffer.meta.limitTypes[type] = { ...params };
        }
      });

      // Sizes/HalfKomi
      this.sizes = Object.keys(buffer.meta.sizeHalfKomis).map(Number);
      this.allSizes.forEach((size) => {
        if (!(size in buffer.meta.sizeHalfKomis)) {
          buffer.meta.sizeHalfKomis[size] = [];
        }
      });

      // Bot Options
      this.options = Object.keys(this.botMeta.presetOptions || {});
      buffer.meta.presetOptions = {
        ...this.botMeta.options,
        ...cloneDeep(this.botMeta.presetOptions),
      };
      forEach(this.bot.getOptions(), (value, key) => {
        if (!("value" in buffer.meta.presetOptions[key])) {
          buffer.meta.presetOptions[key].value = value;
        }
      });

      this.buffer = buffer;
    },
    async submit() {
      // Validate
      this.error = "";
      if (!this.limitTypes.length) {
        this.error = "limitTypeRequired";
        return;
      }
      if (!this.sizes.length) {
        this.error = "sizeHalfKomiRequired";
        return;
      }

      // Sanitize
      this.$store.dispatch;
      forEach(this.buffer.meta.sizeHalfKomis, (komi, size) => {
        if (this.sizes.includes(Number(size)) && komi.length === 0) {
          komi.push(0);
        }
      });
      let reconnect = false;
      const buffer = cloneDeep(this.buffer);
      buffer.meta.limitTypes = pick(buffer.meta.limitTypes, this.limitTypes);
      buffer.meta.sizeHalfKomis = pick(buffer.meta.sizeHalfKomis, this.sizes);
      buffer.meta.options = omit(buffer.meta.presetOptions, this.options);
      buffer.meta.presetOptions = pick(buffer.meta.presetOptions, this.options);

      // Sanitize Limit Types
      if (this.$store.state.analysis.botSettings[buffer.id]) {
        let limitTypesEnabled;
        if (this.limitTypes.length > 1) {
          limitTypesEnabled = this.bot.settings.limitTypes.filter(
            (type) => type in buffer.meta.limitTypes
          );
          if (limitTypesEnabled.length === 0) {
            limitTypesEnabled = this.limitTypes[0];
          }
        } else {
          limitTypesEnabled = this.limitTypes;
        }
        const settings = cloneDeep(this.$store.state.analysis.botSettings);
        if (
          settings[buffer.id] &&
          !isEqual(this.bot.settings.limitTypes, limitTypesEnabled)
        ) {
          settings[buffer.id].limitTypes = limitTypesEnabled;
          this.$store.dispatch("analysis/SET", ["botSettings", settings]);
        }
      }

      if (this.isNew) {
        reconnect = this.bot.state.isConnected;
        this.bot.disconnect();
      }

      if (await this.$store.dispatch("analysis/SAVE_BOT", buffer)) {
        if (reconnect) {
          this.bot.connect();
        } else if (!this.bot.hasOptions) {
          // Intialize automatically if no options
          this.bot.applyOptions();
        }
        this.close();
      }
    },
    deleteBot() {
      if (this.isNew) {
        return;
      }
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.deleteBot"),
        success: () => {
          this.$store.dispatch("analysis/DELETE_BOT", this.bot.id);
          this.close();
        },
      });
    },
  },
  mounted() {
    this.reset();
  },
};
</script>
