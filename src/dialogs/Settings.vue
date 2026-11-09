<template>
  <large-dialog
    ref="dialog"
    :value="true"
    content-class="settings-dialog"
    @show="onShow"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="settings">
        <template v-if="narrow && showCategory && !searching" v-slot:icon>
          <q-btn @click="back" icon="arrow_back" dense flat>
            <hint>{{ $t("Back") }}</hint>
          </q-btn>
        </template>
        {{
          narrow && showCategory && !searching
            ? $t(category.label)
            : $t("Settings")
        }}
      </dialog-header>
      <q-input
        ref="search"
        v-model="query"
        :placeholder="$t('settings.Search Settings')"
        clearable
        filled
        square
        dense
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </template>

    <div ref="body" class="row no-wrap">
      <q-list
        v-if="!searching && (!narrow || !showCategory)"
        :class="narrow ? 'col-grow' : 'settings-categories'"
        :style="narrow ? null : { top: stickyTop + 'px' }"
      >
        <template v-for="c in categories">
          <q-item
            :key="c.id"
            :data-category="c.id"
            :active="!narrow && c.id === category.id"
            :aria-current="!narrow && c.id === category.id ? 'true' : null"
            @click="selectCategory(c.id)"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <q-icon :name="c.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t(c.label) }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="narrow" side>
              <q-icon name="forward" />
            </q-item-section>
          </q-item>
          <!-- The selected category's sections, when it has several -->
          <template
            v-if="!narrow && c.id === category.id && c.sections.length > 1"
          >
            <q-item
              v-for="s in c.sections"
              :key="c.id + '/' + s.id"
              :data-section-link="c.id + '/' + s.id"
              :active="currentSection === c.id + '/' + s.id"
              @click="selectSection(c.id, s.id)"
              class="settings-section-link"
              clickable
              dense
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{ $t(s.label) }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </template>
      </q-list>

      <q-separator
        v-if="!narrow && !searching"
        class="settings-columns-separator"
        vertical
      />

      <div v-if="searching" class="col-grow settings-category settings-results">
        <div
          v-for="group in groups"
          :key="group.entry.id"
          :data-result="group.entry.id"
          class="settings-result"
        >
          <q-item-label class="settings-breadcrumb" caption>
            {{ group.breadcrumb }}
          </q-item-label>
          <setting-row :entry="group.entry" />
        </div>
        <q-item v-if="!groups.length">
          <q-item-section class="text-grey">
            {{ $t("settings.noResults", { query: searchQuery }) }}
          </q-item-section>
        </q-item>
      </div>

      <div v-else-if="showCategory" class="col-grow settings-category">
        <settings-section
          v-for="s in category.sections"
          :key="category.id + '/' + s.id"
          :category="category.id"
          :section="s.id"
        />
      </div>
    </div>
  </large-dialog>
</template>

<script>
import { scroll } from "quasar";
import { debounce } from "lodash";
import { CATEGORIES, byId, entryState, search } from "../settings/registry";

// An element's top in the page layout, ignoring scrolling and transforms
const layoutTop = (element) => {
  let top = 0;
  for (; element; element = element.offsetParent) {
    top += element.offsetTop;
  }
  return top;
};

export default {
  name: "Settings",
  provide() {
    // Lets rows that list live data (e.g. engines) narrow to the search
    return { settingsQuery: () => this.searchQuery };
  },
  data() {
    return {
      categories: CATEGORIES,
      query: "",
      // The query as of 150 ms after the last keystroke
      searchQuery: "",
      // Height of the dialog header, which covers the top of the scroll area
      stickyTop: 0,
      // "category/section" at the top of the scroll area
      currentSection: null,
    };
  },
  created() {
    this.updateSearch = debounce((query) => {
      this.searchQuery = (query || "").trim();
    }, 150);
  },
  beforeDestroy() {
    this.updateSearch.cancel();
    this.unwatchScroll();
  },
  computed: {
    searching() {
      return Boolean(this.searchQuery);
    },
    // Search results as top-level entries, each with its children and a
    // breadcrumb. A group whose matches are all hidden is left out.
    groups() {
      if (!this.searching) {
        return [];
      }
      const results = search(this.searchQuery, this.$t.bind(this), {
        "analysis:activeBots": this.$store.state.analysis.botList.map(
          (bot) => bot.label
        ),
      });
      const state = (entry) =>
        entryState(
          this.$store.state,
          this.$store.getters["game/disabledOptions"],
          entry
        );
      return results
        .filter(({ entry }) => !entry.dependsOn)
        .filter((top) =>
          results.some(
            (r) =>
              !r.context &&
              !state(r.entry).hidden &&
              this.rootOf(r.entry) === top.entry
          )
        )
        .map(({ entry }) => {
          const category = CATEGORIES.find((c) => c.id === entry.category);
          const section = category.sections.find((s) => s.id === entry.section);
          return {
            entry,
            breadcrumb: `${this.$t(category.label)} › ${this.$t(
              section.label
            )}`,
          };
        });
    },
    narrow() {
      return this.$q.screen.lt.sm;
    },
    // The category in the route, if it exists
    routeCategory() {
      return CATEGORIES.find((c) => c.id === this.$route.params.category);
    },
    // The category shown, falling back to the first
    category() {
      return this.routeCategory || CATEGORIES[0];
    },
    // Narrow screens show the category list until a category is chosen
    showCategory() {
      return !this.narrow || Boolean(this.routeCategory);
    },
  },
  methods: {
    rootOf(entry) {
      while (entry.dependsOn) {
        entry = byId(entry.dependsOn);
      }
      return entry;
    },
    selectSection(category, section) {
      if (
        category === this.$route.params.category &&
        section === this.$route.params.section
      ) {
        this.scrollToSection();
      } else {
        this.$router.replace({
          name: "settings",
          params: { category, section },
        });
      }
    },
    // The section at the top of the scroll area, for the sub-item highlight
    updateCurrentSection() {
      const dialog = document.querySelector(".settings-dialog");
      const sections = dialog
        ? [...dialog.querySelectorAll(".settings-category [data-section]")]
        : [];
      const header = dialog && dialog.querySelector(".q-header");
      const top = header ? header.getBoundingClientRect().bottom + 16 : 0;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= top) {
          current = section;
        }
      });
      this.currentSection = current ? current.dataset.section : null;
    },
    // Follow the scroll area to keep the highlight current
    watchScroll() {
      this.unwatchScroll();
      this.$nextTick(() => {
        const dialog = document.querySelector(".settings-dialog");
        const first = dialog && dialog.querySelector("[data-section]");
        if (!first) {
          return;
        }
        this.scrollTarget = scroll.getScrollTarget(first);
        this.onScroll = () => this.updateCurrentSection();
        this.scrollTarget.addEventListener("scroll", this.onScroll, {
          passive: true,
        });
        this.updateCurrentSection();
      });
    },
    unwatchScroll() {
      if (this.scrollTarget && this.onScroll) {
        this.scrollTarget.removeEventListener("scroll", this.onScroll);
      }
      this.scrollTarget = null;
    },
    selectCategory(id) {
      if (id !== this.$route.params.category) {
        this.$router.replace({ name: "settings", params: { category: id } });
      }
    },
    back() {
      this.$router.replace({ name: "settings" });
    },
    onShow() {
      this.updateStickyTop();
      this.watchScroll();
      this.scrollToSection();
      if (this.$route.query.focus === "search" && this.$refs.search) {
        this.$refs.search.focus();
      }
    },
    // Keep the sticky category list below the dialog header
    updateStickyTop() {
      this.$nextTick(() => {
        const page =
          this.$refs.body && this.$refs.body.closest(".q-page-container");
        this.stickyTop = page
          ? parseFloat(getComputedStyle(page).paddingTop) || 0
          : 0;
      });
    },
    // Scroll to the route's section, or to the top without one
    scrollToSection() {
      const section = this.routeCategory && this.$route.params.section;
      this.$nextTick(() => {
        const dialog = document.querySelector(".settings-dialog");
        const first = dialog && dialog.querySelector("[data-section]");
        if (!first) {
          return;
        }
        const target = scroll.getScrollTarget(first);
        const element =
          section &&
          dialog.querySelector(
            `[data-section="${this.category.id}/${section}"]`
          );
        if (!element) {
          scroll.setScrollPosition(target, 0);
          return;
        }
        // The header overlaps the scroll area, so stop below it. Layout
        // offsets, unlike client rects, ignore the dialog's show transition.
        const header = dialog.querySelector(".q-header");
        scroll.setScrollPosition(
          target,
          layoutTop(element) -
            layoutTop(target) -
            (header ? header.offsetHeight : 0)
        );
      });
    },
  },
  watch: {
    narrow() {
      this.updateStickyTop();
    },
    query(value) {
      this.updateSearch(value);
    },
    "$route.params.category"() {
      this.scrollToSection();
      this.watchScroll();
    },
    "$route.params.section"() {
      this.scrollToSection();
    },
  },
};
</script>

<style lang="scss">
.settings-dialog {
  .settings-section-link {
    padding-left: 72px;
    min-height: 32px;
    font-size: 0.9em;
  }
  .settings-breadcrumb {
    padding: 8px 16px 0;
  }
  .settings-categories {
    flex: 0 0 200px;
    position: sticky;
    align-self: flex-start;
  }
  // The sticky list paints above static siblings; keep the line on top
  .settings-columns-separator {
    position: relative;
    z-index: 1;
  }
  .settings-category {
    min-width: 0;
  }
}
</style>
