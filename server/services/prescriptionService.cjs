const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const prescriptionRepo = createRepository({ name: 'prescriptions', model: models.Prescription, prefix: 'PRX' });
const auditRepo = createRepository({ name: 'prescription_audits', model: models.PrescriptionAudit, prefix: 'PRA' });

async function createAudit(prescriptionId, actor, eventType, note = '', metadata = {}) {
  return auditRepo.create({
    prescriptionId,
    actorId: actor.id,
    actorRole: actor.role,
    eventType,
    note,
    metadata
  });
}

module.exports = {
  prescriptionRepo,
  auditRepo,
  createAudit
};

