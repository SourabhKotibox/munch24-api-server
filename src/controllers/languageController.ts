import type { FastifyReply, FastifyRequest } from 'fastify';
import { LanguageModel } from '../models/Language';
import uploadHandler from '../lib/uploadHandler';

// Helper function to get full image URL
async function getImageUrl(filePath: string | null | undefined): Promise<string | null> {
  if (!filePath) return null;
  
  if (filePath.startsWith('http')) return filePath;

  let rel = filePath;
  if (!rel.startsWith('/uploads/')) {
    rel = rel.startsWith('uploads/') ? `/${rel}` : `/uploads/${rel.replace(/^\//, '')}`;
  }
  return rel;
}

export const listLanguages = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as { includeSkip?: string };
    const includeSkip = query.includeSkip === 'true';

    const languages = await LanguageModel.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();

    const filteredLanguages = await Promise.all(languages.map(async (lang) => ({
      id: lang._id.toString(),
      name: lang.name,
      code: lang.code,
      image: await getImageUrl(lang.image),
      isActive: lang.isActive,
      order: lang.order,
      createdAt: lang.createdAt,
      updatedAt: lang.updatedAt
    })));

    const data = includeSkip
      ? [
          {
            id: 'skip',
            name: 'Skip',
            code: 'skip',
            image: null,
            isActive: true,
            order: -1,
            createdAt: null,
            updatedAt: null,
            isSkippable: true,
          },
          ...filteredLanguages,
        ]
      : filteredLanguages;

    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error('Error in listLanguages:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const language = await LanguageModel.findById(id).lean();

    if (!language) {
      return reply.status(404).send({ success: false, message: 'Language not found' });
    }

    return {
      success: true,
      data: {
        id: language._id.toString(),
        name: language.name,
        code: language.code,
        image: await getImageUrl(language.image),
        isActive: language.isActive,
        order: language.order,
        createdAt: language.createdAt,
        updatedAt: language.updatedAt
      }
    };
  } catch (error) {
    console.error('Error getting language:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const createLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parts = request.parts();
    let name: string | undefined;
    let code: string | undefined;
    let imagePath: string | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'name') name = part.value as string;
        if (part.fieldname === 'code') code = part.value as string;
        if (part.fieldname === 'image') imagePath = part.value as string;
      } else if (part.type === 'file') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'LANGUAGE');
        imagePath = uploadedFile.filePath;
      }
    }

    if (!name || !code) {
      return reply.status(400).send({
        success: false,
        message: 'Name and code are required'
      });
    }

    const language = new LanguageModel({ name, code, image: imagePath });
    await language.save();

    return reply.status(201).send({
      success: true,
      data: {
        id: language._id.toString(),
        name: language.name,
        code: language.code,
        image: await getImageUrl(language.image),
        isActive: language.isActive,
        order: language.order
      }
    });
  } catch (error: any) {
    console.error('Error creating language:', error.message, error.stack);
    return reply.status(500).send({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

export const updateLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    
    const parts = request.parts();
    const updateData: any = {};
    let oldImage: string | undefined;

    const existingLang = await LanguageModel.findById(id);
    if (!existingLang) {
      return reply.status(404).send({ success: false, message: 'Language not found' });
    }
    oldImage = existingLang.image;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'name') updateData.name = part.value;
        if (part.fieldname === 'code') updateData.code = part.value;
        if (part.fieldname === 'isActive') updateData.isActive = part.value === 'true';
        if (part.fieldname === 'order') updateData.order = parseInt(part.value as string);
        if (part.fieldname === 'image') updateData.image = part.value;
      } else if (part.type === 'file') {
        const uploadedFile = await uploadHandler.saveFileFromPart(part, request, 'LANGUAGE');
        updateData.image = uploadedFile.filePath;
        
        // Delete old image if it exists
        if (oldImage) {
          uploadHandler.deleteUploadedFile(oldImage);
        }
      }
    }

    const language = await LanguageModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after' }
    ).lean();

    if (!language) {
      return reply.status(404).send({ success: false, message: 'Language not found' });
    }

    return {
      success: true,
      data: {
        id: language._id.toString(),
        name: language.name,
        code: language.code,
        image: await getImageUrl(language.image),
        isActive: language.isActive,
        order: language.order
      }
    };
  } catch (error) {
    console.error('Error updating language:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

export const deleteLanguage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const language = await LanguageModel.findById(id);

    if (!language) {
      return reply.status(404).send({ success: false, message: 'Language not found' });
    }

    // Delete image file if it exists
    if (language.image) {
      uploadHandler.deleteUploadedFile(language.image);
    }

    await LanguageModel.findByIdAndDelete(id);

    return reply.status(200).send({
      success: true,
      message: 'Language deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting language:', error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};
