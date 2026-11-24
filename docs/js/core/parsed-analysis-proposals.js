const PROPOSAL_TYPES = new Set(['clause', 'constituent', 'role', 'dependency', 'verbal-feature', 'connective-cue']);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeProposal(unit, proposal, provenance) {
  requireValue(proposal && typeof proposal.id === 'string' && proposal.id.trim(), 'Every parsed proposal requires an ID.');
  requireValue(PROPOSAL_TYPES.has(proposal.type), `Unsupported parsed proposal type: ${proposal.type ?? 'missing'}.`);
  requireValue(Array.isArray(proposal.tokenIds) && proposal.tokenIds.length > 0, 'Every parsed proposal requires token anchors.');
  const known = new Set(unit.tokens.map(item => item.id));
  requireValue(new Set(proposal.tokenIds).size === proposal.tokenIds.length && proposal.tokenIds.every(id => known.has(id)),
    `Parsed proposal ${proposal.id} contains an unmapped token ID.`);
  requireValue(proposal.confidence === undefined || (Number.isFinite(proposal.confidence)
    && proposal.confidence >= 0 && proposal.confidence <= 1), 'Proposal confidence must be between 0 and 1.');
  requireValue(proposal.data && typeof proposal.data === 'object' && !Array.isArray(proposal.data),
    'Every parsed proposal requires typed proposal data.');
  return Object.freeze({ id: proposal.id.trim(), type: proposal.type, tokenIds: [...proposal.tokenIds],
    data: structuredClone(proposal.data), status: 'proposed',
    ...(proposal.confidence === undefined ? {} : { confidence: proposal.confidence }),
    ...(proposal.sourceRef ? { sourceRef: String(proposal.sourceRef) } : {}), provenance: { ...provenance } });
}

/** Validate an identified, edition-specific parse without projecting or accepting it. */
export function adaptParsedAnalysisDataset(unit, dataset, existingIds = []) {
  requireValue(dataset && typeof dataset === 'object', 'Parsed analysis dataset is missing.');
  const identity = dataset.dataset;
  requireValue(identity && ['id', 'version', 'language', 'sourceId'].every(key => typeof identity[key] === 'string' && identity[key].trim()),
    'Parsed dataset identity requires id, version, language, and sourceId.');
  requireValue(identity.language === unit.source.language, `Parsed dataset language ${identity.language} does not match ${unit.source.language}.`);
  requireValue(identity.sourceId === unit.source.sourceId, `Parsed dataset source ${identity.sourceId} does not match ${unit.source.sourceId}.`);
  requireValue(Array.isArray(dataset.proposals), 'Parsed dataset proposals must be an array.');
  const provenance = Object.freeze({ providerId: identity.id, version: identity.version,
    language: identity.language, sourceId: identity.sourceId });
  const proposals = dataset.proposals.map(item => normalizeProposal(unit, item, provenance));
  const ids = [...existingIds, ...proposals.map(item => item.id)];
  requireValue(new Set(ids).size === ids.length, 'Parsed proposal IDs must be unique in this analysis.');
  return proposals;
}

/** Revalidate normalized proposal records restored from a portable backup. */
export function restoreParsedAnalysisProposals(unit, records = []) {
  requireValue(Array.isArray(records), 'Parsed analysis proposals must be an array.');
  const restored = records.map(record => {
    requireValue(record.status === 'proposed', 'Only unaccepted parsed proposals can be restored by this adapter.');
    return normalizeProposal(unit, record, record.provenance);
  });
  requireValue(new Set(restored.map(item => item.id)).size === restored.length, 'Parsed proposal IDs must be unique in this analysis.');
  return restored;
}
