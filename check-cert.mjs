import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});

const prisma = new PrismaClient({
  adapter,
});

async function check() {
  // Find certificate by number
  const cert = await prisma.certificate.findFirst({
    where: { certificateNumber: 'HTA/C50608/02/26' },
    select: { id: true, certificateNumber: true, status: true, currentRevision: true, signedPdfPath: true }
  });

  if (!cert) {
    console.log('Certificate not found');
    return;
  }

  console.log('Certificate:', JSON.stringify(cert, null, 2));

  // Get all signatures
  const signatures = await prisma.signature.findMany({
    where: { certificateId: cert.id },
    select: { id: true, signerType: true, signerName: true, signedAt: true, signatureData: true }
  });

  // Show signatures with signatureData presence (not full data - too long)
  const signaturesForDisplay = signatures.map(s => ({
    ...s,
    signatureData: s.signatureData ? `[${s.signatureData.length} chars]` : null
  }));
  console.log('\nSignatures:', JSON.stringify(signaturesForDisplay, null, 2));

  // Get signing evidence
  const evidence = await prisma.signingEvidence.findMany({
    where: { certificateId: cert.id },
    select: { id: true, signatureId: true, eventType: true, revision: true, sequenceNumber: true }
  });

  console.log('\nSigning Evidence:', JSON.stringify(evidence, null, 2));

  // Check if admin signature has matching evidence
  const adminSig = signatures.find(s => s.signerType === 'ADMIN');
  if (adminSig) {
    console.log('\nAdmin Signature found:', adminSig.id);
    const adminEvidence = evidence.filter(e =>
      e.signatureId === adminSig.id || e.eventType === 'ADMIN_SIGNED'
    );
    console.log('Admin Evidence:', JSON.stringify(adminEvidence, null, 2));

    // Check revision match
    const currentRevEvidence = adminEvidence.filter(e => e.revision === cert.currentRevision);
    console.log('Evidence for current revision:', JSON.stringify(currentRevEvidence, null, 2));
  } else {
    console.log('\nNo ADMIN signature found!');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
