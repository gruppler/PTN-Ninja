<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 300px" class="bg-secondary">
      <DialogHeader>{{ $t("Play Online") }}</DialogHeader>

      <SmoothReflow class="col">
        <Recess>
          <div class="scroll" style="max-height: calc(100vh - 18.5rem)">
            <div v-if="this.isLocal">
              <q-list>
                <q-item tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Road Connections") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="showRoads" />
                  </q-item-section>
                </q-item>
              </q-list>
              <q-card-section>
                <div class="text-center">
                  <q-btn
                    @click="create"
                    :label="$t('Create Online Game')"
                    color="accent"
                    flat
                  />
                </div>
              </q-card-section>
            </div>
            <div v-else>
              <q-card-section>
                links
              </q-card-section>
            </div>
          </div>
        </Recess>
      </SmoothReflow>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader";

export default {
  name: "ShareOnline",
  components: { DialogHeader },
  props: ["value", "game"],
  data() {
    return {
      showRoads: false
    };
  },
  computed: {
    isLocal() {
      return this.game.isLocal;
    }
  },
  methods: {
    create() {
      this.$store.dispatch("online/CREATE", {
        game: this.game,
        options: {
          disableRoads: !this.showRoads
        }
      });
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        //
      }
    }
  }
};
</script>
