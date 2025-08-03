<template>
  <large-dialog id="help-dialog" ref="dialog" :value="true" v-bind="$attrs">
    <template v-slot:header>
      <q-tabs
        v-model="section"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="about" icon="info" :label="$t('About')" />
        <q-tab name="usage" icon="help" :label="$t('Usage')" />
        <q-tab name="hotkeys" icon="keyboard" :label="$t('Hotkeys')" />
      </q-tabs>
      <smooth-reflow>
        <q-input
          v-show="section === 'hotkeys'"
          v-model="filter"
          class="col-grow"
          clearable
          filled
          square
          dense
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </smooth-reflow>
    </template>

    <div ref="help" class="help">
      <q-tab-panels v-model="section" animated persistent>
        <q-tab-panel name="about">
          <q-markdown ref="markdown" :src="about" no-heading-anchor-links />
        </q-tab-panel>

        <q-tab-panel name="usage">
          <ul class="toc" v-if="toc && width < 1200">
            <li v-for="parent in toc" :key="parent.id">
              <a
                :href="$route.path + '#' + parent.id"
                @click.prevent="tocScroll(parent.id)"
                >{{ parent.label }}</a
              >
              <ul v-if="parent.children.length">
                <li v-for="child in parent.children" :key="child.id">
                  <a
                    :href="$route.path + '#' + child.id"
                    @click.prevent="tocScroll(child.id)"
                    >{{ child.label }}</a
                  >
                </li>
              </ul>
            </li>
          </ul>
          <q-page-sticky position="top-left" v-else-if="toc" :offset="[6, 6]">
            <ul class="toc" v-if="toc">
              <li v-for="parent in toc" :key="parent.id">
                <a
                  :href="$route.path + '#' + parent.id"
                  @click.prevent="tocScroll(parent.id)"
                  >{{ parent.label }}</a
                >
                <ul v-if="parent.children.length">
                  <li v-for="child in parent.children" :key="child.id">
                    <a
                      :href="$route.path + '#' + child.id"
                      @click.prevent="tocScroll(child.id)"
                      >{{ child.label }}</a
                    >
                  </li>
                </ul>
              </li>
            </ul>
          </q-page-sticky>
          <q-markdown
            ref="markdown"
            :src="usage"
            no-heading-anchor-links
            toc
            @data="onTOC"
          />
          <q-page-sticky position="top-right" :offset="[6, 6]">
            <FullscreenToggle
              ref="fullscreen"
              :target="$refs.help"
              class="dimmed-btn"
              v-ripple="false"
              flat
              fab
            />
          </q-page-sticky>
          <q-page-sticky position="bottom-right" :offset="[6, 6]">
            <q-btn
              @click="tocScroll(0)"
              class="dimmed-btn"
              v-ripple="false"
              icon="to_top"
              flat
              fab
            />
          </q-page-sticky>
          <q-resize-observer @resize="onResize" />
        </q-tab-panel>

        <q-tab-panel name="hotkeys">
          <q-markdown ref="markdown" no-heading-anchor-links>{{
            $t("Hotkeys") + "\n==="
          }}</q-markdown>
          <Hotkeys ref="hotkeys" v-model="filter" />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import Hotkeys from "../components/general/Hotkeys.vue";
import FullscreenToggle from "../components/controls/FullscreenToggle";

export default {
  name: "Help",
  components: { Hotkeys, FullscreenToggle },
  data() {
    return {
      about: "",
      usage: "",
      filter: "",
      toc: null,
      width: null,
    };
  },
  computed: {
    section: {
      get() {
        return this.$route.params.section || "about";
      },
      set(section) {
        this.$router.replace({ params: { section } });
      },
    },
  },
  methods: {
    onResize({ width }) {
      this.width = width;
    },
    onTOC(toc) {
      if (this.$refs.markdown) {
        this.toc = this.$refs.markdown.makeTree(toc);
      }
    },
    isFullscreen() {
      return this.$refs.fullscreen ? this.$refs.fullscreen.isActive : false;
    },
    getScroller() {
      return this.isFullscreen()
        ? document.querySelector("#help-dialog .help")
        : document.querySelector("#help-dialog .scroll");
    },
    tocScroll(id) {
      const scroller = this.getScroller();
      if (!scroller) {
        return;
      }
      if (id === 0) {
        scroller.scrollTop = 0;
      } else {
        const el = document.getElementById(id);
        if (el) {
          scroller.scrollTop = el.offsetTop;
        }
      }
    },
  },
  created() {
    import(`../i18n/${this.$i18n.locale}/about.md`)
      .then((about) => {
        this.about = about.default;
      })
      .catch((error) => {
        console.log(error);
        import(`../i18n/${this.$i18n.fallbackLocale}/about.md`).then(
          (about) => {
            this.about = about.default;
          }
        );
      });
    import(`../i18n/${this.$i18n.locale}/usage.md`)
      .then((usage) => {
        this.usage = usage.default;
      })
      .catch((error) => {
        console.log(error);
        import(`../i18n/${this.$i18n.fallbackLocale}/usage.md`).then(
          (usage) => {
            this.usage = usage.default;
          }
        );
      });
  },
};
</script>

<style lang="scss">
.help {
  overflow: auto;

  h6 {
    margin-top: 0;
    margin-bottom: 1em;
    ~ h6 {
      margin-top: 1.5em;
    }
  }

  a {
    color: $primary;
    color: var(--q-color-primary);
    border-bottom: none;
    white-space: nowrap;
    text-decoration: underline;
  }

  ul ul {
    padding-inline-start: 16px;
  }

  .toc {
    float: left;
    position: relative;
    z-index: 1;
    padding-left: 0;
    margin-left: 16px;
    margin-right: 1em;

    font-weight: bold;

    ul {
      font-weight: normal;
    }
  }

  .q-markdown {
    max-width: 900px;
    margin: 0 auto;

    .q-markdown--link {
      &.q-markdown--link-external:after {
        content: "\F03CC";
        font-family: "Material Design Icons";
      }
    }

    .q-markdown--note {
      clear: left;
    }

    .q-markdown--note--tip {
      float: right;
      width: 40%;
      margin-left: 1em;
    }
  }
}
</style>
