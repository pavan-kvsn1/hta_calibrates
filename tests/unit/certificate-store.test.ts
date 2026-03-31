import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useCertificateStore } from '@/lib/stores/certificate-store'

describe('useCertificateStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    // We need to completely reset the store including isHydrated
    useCertificateStore.setState({
      formData: {
        certificateNumber: '',
        status: 'DRAFT',
        lastSaved: null,
        calibratedAt: 'LAB',
        srfNumber: '',
        srfDate: '',
        dateOfCalibration: '',
        calibrationTenure: 12,
        dueDateAdjustment: 0,
        calibrationDueDate: '',
        dueDateNotApplicable: false,
        customerName: '',
        customerAddress: '',
        uucDescription: '',
        uucMake: '',
        uucModel: '',
        uucSerialNumber: '',
        uucInstrumentId: '',
        uucLocationName: '',
        uucMachineName: '',
        parameters: [{
          id: 'test-param-id',
          parameterName: '',
          parameterUnit: '',
          rangeMin: '',
          rangeMax: '',
          rangeUnit: '',
          operatingMin: '',
          operatingMax: '',
          operatingUnit: '',
          leastCountValue: '',
          leastCountUnit: '',
          accuracyValue: '',
          accuracyUnit: '',
          accuracyType: 'ABSOLUTE',
          requiresBinning: false,
          bins: [],
          errorFormula: 'A-B',
          results: [{
            id: 'test-result-id',
            pointNumber: 1,
            standardReading: '',
            beforeAdjustment: '',
            afterAdjustment: '',
            errorObserved: null,
            isOutOfLimit: false,
          }],
          showAfterAdjustment: false,
          masterInstrumentId: null,
          sopReference: '',
        }],
        masterInstruments: [{
          id: 'test-master-id',
          masterInstrumentId: 0,
          category: '',
          description: '',
          make: '',
          model: '',
          assetNo: '',
          serialNumber: '',
          calibratedAt: '',
          reportNo: '',
          calibrationDueDate: '',
          isExpired: false,
          isExpiringSoon: false,
        }],
        ambientTemperature: '',
        relativeHumidity: '',
        calibrationStatus: [],
        stickerOldRemoved: null,
        stickerNewAffixed: null,
        statusNotes: '',
        selectedConclusionStatements: [],
        additionalConclusionStatement: '',
        engineerNotes: '',
        sectionResponses: {},
        serverUpdatedAt: null,
      },
      isDirty: false,
      isSaving: false,
      validationErrors: {},
      isHydrated: false,
      certificateId: null,
    })
  })

  describe('initial state', () => {
    it('has correct initial form data', () => {
      const { formData } = useCertificateStore.getState()
      expect(formData.status).toBe('DRAFT')
      expect(formData.calibratedAt).toBe('LAB')
      expect(formData.calibrationTenure).toBe(12)
      expect(formData.parameters).toHaveLength(1)
      expect(formData.masterInstruments).toHaveLength(1)
    })

    it('starts with isDirty as false', () => {
      const { isDirty } = useCertificateStore.getState()
      expect(isDirty).toBe(false)
    })

    it('starts with isSaving as false', () => {
      const { isSaving } = useCertificateStore.getState()
      expect(isSaving).toBe(false)
    })

    it('starts with isHydrated as false', () => {
      const { isHydrated } = useCertificateStore.getState()
      expect(isHydrated).toBe(false)
    })
  })

  describe('hydrate', () => {
    it('sets isHydrated to true', () => {
      act(() => {
        useCertificateStore.getState().hydrate()
      })
      expect(useCertificateStore.getState().isHydrated).toBe(true)
    })

    it('generates certificate number', () => {
      act(() => {
        useCertificateStore.getState().hydrate()
      })
      const { formData } = useCertificateStore.getState()
      expect(formData.certificateNumber).toMatch(/^HTA\/C\d{5}\/\d{2}\/\d{2}$/)
    })

    it('sets dateOfCalibration to today', () => {
      act(() => {
        useCertificateStore.getState().hydrate()
      })
      const { formData } = useCertificateStore.getState()
      const today = new Date().toISOString().split('T')[0]
      expect(formData.dateOfCalibration).toBe(today)
    })

    it('only hydrates once', () => {
      act(() => {
        useCertificateStore.getState().hydrate()
      })
      const firstCertNumber = useCertificateStore.getState().formData.certificateNumber

      act(() => {
        useCertificateStore.getState().hydrate()
      })
      const secondCertNumber = useCertificateStore.getState().formData.certificateNumber

      expect(firstCertNumber).toBe(secondCertNumber)
    })
  })

  describe('setFormField', () => {
    it('updates a simple field', () => {
      act(() => {
        useCertificateStore.getState().setFormField('customerName', 'Test Company')
      })
      expect(useCertificateStore.getState().formData.customerName).toBe('Test Company')
    })

    it('sets isDirty to true', () => {
      act(() => {
        useCertificateStore.getState().setFormField('customerName', 'Test')
      })
      expect(useCertificateStore.getState().isDirty).toBe(true)
    })

    it('recalculates due date when dateOfCalibration changes', () => {
      act(() => {
        useCertificateStore.getState().setFormField('dateOfCalibration', '2024-01-15')
      })
      const { formData } = useCertificateStore.getState()
      expect(formData.calibrationDueDate).toBe('2025-01-15')
    })

    it('recalculates due date when tenure changes', () => {
      act(() => {
        useCertificateStore.getState().setFormField('dateOfCalibration', '2024-01-15')
        useCertificateStore.getState().setFormField('calibrationTenure', 6)
      })
      const { formData } = useCertificateStore.getState()
      expect(formData.calibrationDueDate).toBe('2024-07-15')
    })

    it('applies due date adjustment', () => {
      act(() => {
        useCertificateStore.getState().setFormField('dateOfCalibration', '2024-01-15')
        useCertificateStore.getState().setFormField('dueDateAdjustment', -3)
      })
      const { formData } = useCertificateStore.getState()
      expect(formData.calibrationDueDate).toBe('2025-01-12')
    })
  })

  describe('parameter management', () => {
    it('adds a new parameter', () => {
      const initialCount = useCertificateStore.getState().formData.parameters.length

      act(() => {
        useCertificateStore.getState().addParameter()
      })

      expect(useCertificateStore.getState().formData.parameters).toHaveLength(initialCount + 1)
    })

    it('removes a parameter (but keeps at least one)', () => {
      // Add a second parameter first
      act(() => {
        useCertificateStore.getState().addParameter()
      })

      const countAfterAdd = useCertificateStore.getState().formData.parameters.length

      act(() => {
        useCertificateStore.getState().removeParameter(0)
      })

      expect(useCertificateStore.getState().formData.parameters).toHaveLength(countAfterAdd - 1)
    })

    it('does not remove the last parameter', () => {
      act(() => {
        useCertificateStore.getState().removeParameter(0)
      })

      expect(useCertificateStore.getState().formData.parameters).toHaveLength(1)
    })

    it('updates a parameter', () => {
      const originalParam = useCertificateStore.getState().formData.parameters[0]
      const updatedParam = { ...originalParam, parameterName: 'Temperature' }

      act(() => {
        useCertificateStore.getState().setParameter(0, updatedParam)
      })

      expect(useCertificateStore.getState().formData.parameters[0].parameterName).toBe('Temperature')
    })
  })

  describe('result management', () => {
    it('adds a result to a parameter', () => {
      const initialResultCount = useCertificateStore.getState().formData.parameters[0].results.length

      act(() => {
        useCertificateStore.getState().addResult(0)
      })

      expect(useCertificateStore.getState().formData.parameters[0].results).toHaveLength(initialResultCount + 1)
    })

    it('assigns correct point number to new result', () => {
      act(() => {
        useCertificateStore.getState().addResult(0)
      })

      const results = useCertificateStore.getState().formData.parameters[0].results
      expect(results[results.length - 1].pointNumber).toBe(results.length)
    })

    it('removes a result (but keeps at least one)', () => {
      // Add a second result first
      act(() => {
        useCertificateStore.getState().addResult(0)
      })

      act(() => {
        useCertificateStore.getState().removeResult(0, 0)
      })

      expect(useCertificateStore.getState().formData.parameters[0].results).toHaveLength(1)
    })

    it('sets point count correctly', () => {
      act(() => {
        useCertificateStore.getState().setPointCount(0, 5)
      })

      expect(useCertificateStore.getState().formData.parameters[0].results).toHaveLength(5)
    })
  })

  describe('master instrument management', () => {
    it('adds a master instrument', () => {
      const initialCount = useCertificateStore.getState().formData.masterInstruments.length

      act(() => {
        useCertificateStore.getState().addMasterInstrument()
      })

      expect(useCertificateStore.getState().formData.masterInstruments).toHaveLength(initialCount + 1)
    })

    it('removes a master instrument (but keeps at least one)', () => {
      // Add a second instrument first
      act(() => {
        useCertificateStore.getState().addMasterInstrument()
      })

      act(() => {
        useCertificateStore.getState().removeMasterInstrument(0)
      })

      expect(useCertificateStore.getState().formData.masterInstruments).toHaveLength(1)
    })
  })

  describe('calibration status toggle', () => {
    it('adds a status when not present', () => {
      act(() => {
        useCertificateStore.getState().toggleCalibrationStatus('OK')
      })

      expect(useCertificateStore.getState().formData.calibrationStatus).toContain('OK')
    })

    it('removes a status when already present', () => {
      act(() => {
        useCertificateStore.getState().toggleCalibrationStatus('OK')
        useCertificateStore.getState().toggleCalibrationStatus('OK')
      })

      expect(useCertificateStore.getState().formData.calibrationStatus).not.toContain('OK')
    })
  })

  describe('error calculation', () => {
    it('calculates error using A-B formula', () => {
      // Set up parameter with accuracy
      const param = useCertificateStore.getState().formData.parameters[0]
      const updatedParam = {
        ...param,
        accuracyValue: '1',
        accuracyType: 'ABSOLUTE' as const,
        errorFormula: 'A-B',
        results: [{
          ...param.results[0],
          standardReading: '100',
          beforeAdjustment: '99',
        }],
      }

      act(() => {
        useCertificateStore.getState().setParameter(0, updatedParam)
      })

      // Set result to trigger calculation
      act(() => {
        useCertificateStore.getState().setResult(0, 0, updatedParam.results[0])
      })

      const result = useCertificateStore.getState().formData.parameters[0].results[0]
      expect(result.errorObserved).toBe(1) // 100 - 99 = 1
    })

    it('calculates error using B-A formula', () => {
      const param = useCertificateStore.getState().formData.parameters[0]
      const updatedParam = {
        ...param,
        accuracyValue: '1',
        accuracyType: 'ABSOLUTE' as const,
        errorFormula: 'B-A',
        results: [{
          ...param.results[0],
          standardReading: '100',
          beforeAdjustment: '99',
        }],
      }

      act(() => {
        useCertificateStore.getState().setParameter(0, updatedParam)
      })

      act(() => {
        useCertificateStore.getState().setResult(0, 0, updatedParam.results[0])
      })

      const result = useCertificateStore.getState().formData.parameters[0].results[0]
      expect(result.errorObserved).toBe(-1) // 99 - 100 = -1
    })

    it('marks result as out of limit when error exceeds accuracy', () => {
      const param = useCertificateStore.getState().formData.parameters[0]
      const updatedParam = {
        ...param,
        accuracyValue: '0.5',
        accuracyType: 'ABSOLUTE' as const,
        errorFormula: 'A-B',
        results: [{
          ...param.results[0],
          standardReading: '100',
          beforeAdjustment: '99', // Error = 1, exceeds 0.5 accuracy
        }],
      }

      act(() => {
        useCertificateStore.getState().setParameter(0, updatedParam)
      })

      act(() => {
        useCertificateStore.getState().setResult(0, 0, updatedParam.results[0])
      })

      const result = useCertificateStore.getState().formData.parameters[0].results[0]
      expect(result.isOutOfLimit).toBe(true)
    })
  })

  describe('resetForm', () => {
    it('resets all form data to initial state', () => {
      // Make some changes
      act(() => {
        useCertificateStore.getState().setFormField('customerName', 'Test')
        useCertificateStore.getState().addParameter()
      })

      // Reset
      act(() => {
        useCertificateStore.getState().resetForm()
      })

      const { formData, isDirty, certificateId } = useCertificateStore.getState()
      expect(formData.customerName).toBe('')
      expect(formData.parameters).toHaveLength(1)
      expect(isDirty).toBe(false)
      expect(certificateId).toBeNull()
    })
  })

  describe('loadForm', () => {
    it('loads partial form data', () => {
      act(() => {
        useCertificateStore.getState().loadForm({
          customerName: 'Loaded Company',
          customerAddress: '123 Test St',
        })
      })

      const { formData, isDirty } = useCertificateStore.getState()
      expect(formData.customerName).toBe('Loaded Company')
      expect(formData.customerAddress).toBe('123 Test St')
      expect(isDirty).toBe(false) // loadForm sets isDirty to false
    })
  })

  describe('setCertificateId', () => {
    it('sets certificate ID', () => {
      act(() => {
        useCertificateStore.getState().setCertificateId('test-id-123')
      })

      expect(useCertificateStore.getState().certificateId).toBe('test-id-123')
    })

    it('can clear certificate ID', () => {
      act(() => {
        useCertificateStore.getState().setCertificateId('test-id')
        useCertificateStore.getState().setCertificateId(null)
      })

      expect(useCertificateStore.getState().certificateId).toBeNull()
    })
  })

  describe('setIsSaving', () => {
    it('sets saving state to true', () => {
      act(() => {
        useCertificateStore.getState().setIsSaving(true)
      })

      expect(useCertificateStore.getState().isSaving).toBe(true)
    })

    it('sets saving state to false', () => {
      act(() => {
        useCertificateStore.getState().setIsSaving(true)
        useCertificateStore.getState().setIsSaving(false)
      })

      expect(useCertificateStore.getState().isSaving).toBe(false)
    })
  })

  describe('setLastSaved', () => {
    it('sets last saved date and clears isDirty', () => {
      const savedDate = new Date('2024-01-15T10:30:00')

      act(() => {
        useCertificateStore.getState().setFormField('customerName', 'Test') // Make dirty
        useCertificateStore.getState().setLastSaved(savedDate)
      })

      const state = useCertificateStore.getState()
      expect(state.formData.lastSaved).toEqual(savedDate)
      expect(state.isDirty).toBe(false)
    })
  })

  describe('setEngineerNotes', () => {
    it('updates engineer notes', () => {
      act(() => {
        useCertificateStore.getState().setEngineerNotes('Fixed calibration issue')
      })

      expect(useCertificateStore.getState().formData.engineerNotes).toBe('Fixed calibration issue')
      expect(useCertificateStore.getState().isDirty).toBe(true)
    })
  })

  describe('serverUpdatedAt tracking', () => {
    it('starts with serverUpdatedAt as null', () => {
      const { formData } = useCertificateStore.getState()
      expect(formData.serverUpdatedAt).toBeNull()
    })

    it('serverUpdatedAt can be set via loadForm', () => {
      const timestamp = '2024-01-15T10:30:00.000Z'

      act(() => {
        useCertificateStore.getState().loadForm({
          serverUpdatedAt: timestamp,
        })
      })

      expect(useCertificateStore.getState().formData.serverUpdatedAt).toBe(timestamp)
    })

    it('resetForm clears serverUpdatedAt', () => {
      act(() => {
        useCertificateStore.getState().loadForm({
          serverUpdatedAt: '2024-01-15T10:30:00.000Z',
        })
      })

      act(() => {
        useCertificateStore.getState().resetForm()
      })

      expect(useCertificateStore.getState().formData.serverUpdatedAt).toBeNull()
    })
  })

  describe('saveDraft conflict handling', () => {
    beforeEach(() => {
      // Reset fetch mock
      vi.restoreAllMocks()
    })

    it('returns CONFLICT error on 409 response', async () => {
      const serverTimestamp = '2024-01-15T12:00:00.000Z'

      // Mock fetch to return 409 Conflict
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'CONFLICT',
          message: 'Certificate was modified by another user',
          serverUpdatedAt: serverTimestamp,
        }),
      })

      // Set up store with a certificate ID
      act(() => {
        useCertificateStore.getState().setCertificateId('test-cert-id')
        useCertificateStore.getState().setFormField('customerName', 'Test')
      })

      // Attempt to save
      let result: { success: boolean; error?: string; serverTimestamp?: string }
      await act(async () => {
        result = await useCertificateStore.getState().saveDraft()
      })

      expect(result!.success).toBe(false)
      expect(result!.error).toBe('CONFLICT')
      expect(result!.serverTimestamp).toBe(serverTimestamp)
      expect(useCertificateStore.getState().isSaving).toBe(false)
    })

    it('includes clientUpdatedAt in request when serverUpdatedAt is set', async () => {
      const serverTimestamp = '2024-01-15T10:30:00.000Z'
      let capturedBody: Record<string, unknown> | null = null

      // Mock fetch to capture the request body
      global.fetch = vi.fn().mockImplementation(async (_url: string, options: { body: string }) => {
        capturedBody = JSON.parse(options.body)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            certificate: {
              id: 'test-cert-id',
              updatedAt: '2024-01-15T10:31:00.000Z',
            },
          }),
        }
      })

      // Set up store with serverUpdatedAt
      act(() => {
        useCertificateStore.getState().setCertificateId('test-cert-id')
        useCertificateStore.getState().loadForm({
          serverUpdatedAt: serverTimestamp,
        })
        useCertificateStore.getState().setFormField('customerName', 'Test')
      })

      // Save
      await act(async () => {
        await useCertificateStore.getState().saveDraft()
      })

      expect(capturedBody).toBeDefined()
      expect(capturedBody!.clientUpdatedAt).toBe(serverTimestamp)
    })

    it('updates serverUpdatedAt on successful save', async () => {
      const newTimestamp = '2024-01-15T10:31:00.000Z'

      // Mock successful response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          certificate: {
            id: 'test-cert-id',
            updatedAt: newTimestamp,
          },
        }),
      })

      // Set up store
      act(() => {
        useCertificateStore.getState().setCertificateId('test-cert-id')
        useCertificateStore.getState().setFormField('customerName', 'Test')
      })

      // Save
      await act(async () => {
        await useCertificateStore.getState().saveDraft()
      })

      expect(useCertificateStore.getState().formData.serverUpdatedAt).toBe(newTimestamp)
    })
  })
})
