module.exports = async () => ([
  { 'legacy.source': 'aw_node', 'legacy.raw.field_term_source_type.und.tid': '140' },
  { 'legacy.source': 'hp_node', 'legacy.raw.field_term_source_type.und.tid': '163' },
  { 'legacy.source': 'lsl_node', 'legacy.raw.field_term_source_type.und.tid': '22' },
  { 'legacy.source': 'oem_node', 'legacy.raw.field_term_source_type.und.tid': '44' },
  { 'legacy.source': 'pfw_node', 'legacy.raw.field_term_source_type.und.tid': '224' },
  { 'legacy.source': 'pw_node', 'legacy.raw.field_term_source_type.und.tid': '163' },
  { 'legacy.source': 'sc_node', 'legacy.raw.field_term_source_type.und.tid': '22' },
].map((filter) => ({
  filter,
  $addToSet: { labels: 'Supplier Submitted' },
})));
