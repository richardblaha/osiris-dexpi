/**
 * DEXPI MetaData container.
 */

import type { DexpiObject, CustomAttributeOwner, DexpiValue } from './base';

export interface MetaData extends DexpiObject, CustomAttributeOwner {
  approvalDateRepresentation?: string;
  approvalDescription?: any;
  approverName?: string;
  archiveNumber?: string;
  checkerName?: string;
  confidentiality?: string;
  creationDateRepresentation?: string;
  creatorName?: string;
  designerName?: string;
  drafterName?: string;
  drawingName?: string;
  drawingNumber?: string;
  drawingSubTitle?: any;
  enterpriseIdentificationCode?: string;
  enterpriseName?: string;
  fileName?: string;
  industrialComplexIdentificationCode?: string;
  industrialComplexName?: string;
  lastModificationDateRepresentation?: string;
  plantAreaIdentificationCode?: string;
  plantSectionIdentificationCode?: string;
  plantSectionName?: string;
  plantSystemIdentificationCode?: string;
  plantSystemName?: string;
  plantTrainIdentificationCode?: string;
  plantTrainName?: string;
  processPlantIdentificationCode?: string;
  processPlantName?: string;
  projectName?: string;
  projectNumber?: string;
  revisionNumber?: string;
  sheetFormat?: string;
  sheetNumber?: string;
  siteIdentificationCode?: string;
  siteName?: string;
  totalNumberOfSheets?: number;
  unitIdentificationCode?: string;
  attributes?: Record<string, DexpiValue>;
  [key: string]: any;
}
