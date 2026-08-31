// v1 has no author-facing controls: the conflation view is hardcoded (constants.js) since
// multi-year/multi-source selection is explicitly out of scope for v1 (see
// planning/transportny/tasks/current/point-to-point-routing-plugin.md, Scope). Revisit only if
// an author-facing source/view picker is explicitly requested later.
const InternalPanel = () => [];

export { InternalPanel };
