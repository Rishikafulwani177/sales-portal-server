import mongoose from 'mongoose';
import * as crypto from 'crypto';

const mongoUri = process.env.MONGO_URI;

const salesDocumentSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'salesdocuments' },
);

const SalesDocument = mongoose.model('SalesDocument', salesDocumentSchema);

async function main() {
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(mongoUri);

  await SalesDocument.collection.createIndex(
    { quotationPublicId: 1 },
    { unique: true, sparse: true },
  );

  const quotations = await SalesDocument.find({
    type: 'quotation',
    $or: [
      { quotationPublicId: { $exists: false } },
      { quotationPublicId: null },
      { quotationPublicId: '' },
    ],
  }).select('_id');

  for (const quotation of quotations) {
    await SalesDocument.updateOne(
      { _id: quotation._id },
      {
        $set: {
          quotationPublicId: crypto.randomBytes(16).toString('hex'),
        },
      },
    );
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
