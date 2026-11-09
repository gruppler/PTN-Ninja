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
        <template v-if="narrow && showCategory" v-slot:icon>
          <q-btn @click="back" icon="arrow_back" dense flat>
            <hint>{{ $t("Back") }}</hint>
          </q-btn>
        </template>
        {{ narrow && showCategory ? $t(category.label) : $t("Settings") }}
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

    <div class="row no-wrap">
      <q-list
        v-if="!narrow || !showCategory"
        :class="narrow ? 'col-grow' : 'settings-categories'"
      >
        <q-item
          v-for="c in categories"
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
      </q-list>

      <q-separator v-if="!narrow" vertical />

      <div v-if="showCategory" class="col-grow settings-category">
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
import { CATEGORIES } from "../settings/registry";

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
  data() {
    return {
      categories: CATEGORIES,
      query: "",
    };
  },
  computed: {
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
    selectCategory(id) {
      if (id !== this.$route.params.category) {
        this.$router.replace({ name: "settings", params: { category: id } });
      }
    },
    back() {
      this.$router.replace({ name: "settings" });
    },
    onShow() {
      this.scrollToSection();
      if (this.$route.query.focus === "search" && this.$refs.search) {
        this.$refs.search.focus();
      }
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
    "$route.params.category"() {
      this.scrollToSection();
    },
    "$route.params.section"() {
      this.scrollToSection();
    },
  },
};
</script>

<style lang="scss">
.settings-dialog {
  .settings-categories {
    flex: 0 0 200px;
  }
  .settings-category {
    min-width: 0;
  }
}
</style>
