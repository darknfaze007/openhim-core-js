/* eslint-env mocha */

import request from 'supertest'
import logger from 'winston'
import * as server from '../../src/server'
import { AuditModel } from '../../src/model/audits'
import * as testUtils from '../utils'
import * as constants from '../constants'
import { promisify } from 'util'

const { SERVER_PORTS } = constants

describe('API Integration Tests', () =>

  describe('Authentication API tests', () => {
    let authDetails = null

    before(async () => {
      await testUtils.setupTestUsers()
      authDetails = testUtils.getAuthDetails()
      const startPromise = promisify(server.start)
      await startPromise({ apiPort: SERVER_PORTS.apiPort })
      await testUtils.setImmediatePromise()
      await AuditModel.remove()
    })

    afterEach(async () => {
      await AuditModel.remove()
    })

    after(async () => {
      await Promise.all([
        testUtils.cleanupTestUsers(),
        promisify(server.stop)()
      ])
    })

    it('should audit a successful login on an API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)

      const audits = await AuditModel.find()
      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
    })

    it('should audit an unsuccessful login on an API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/channels')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)

      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should NOT audit a successful login on an auditing exempt API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/audits')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(0)
    })

    it('should audit an unsuccessful login on an auditing exempt API endpoint', async () => {
      await request(constants.BASE_URL)
        .get('/audits')
        .set('auth-username', 'wrong@email.org')
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(401)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('8') // failure
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('wrong@email.org')
    })

    it('should NOT audit a successful login on /transactions if the view is not full', async () => {
      await request(constants.BASE_URL)
        .get('/transactions') // default is simple
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(0)
    })

    it('should audit a successful login on /transactions if the view is full', async () => {
      await request(constants.BASE_URL)
        .get('/transactions?filterRepresentation=full')
        .set('auth-username', testUtils.rootUser.email)
        .set('auth-ts', authDetails.authTS)
        .set('auth-salt', authDetails.authSalt)
        .set('auth-token', authDetails.authToken)
        .expect(200)
      const audits = await AuditModel.find({})
      audits.length.should.be.exactly(1)
      audits[0].eventIdentification.eventOutcomeIndicator.should.be.equal('0') // success
      audits[0].eventIdentification.eventTypeCode.code.should.be.equal('110122')
      audits[0].eventIdentification.eventTypeCode.displayName.should.be.equal('Login')
      audits[0].activeParticipant.length.should.be.exactly(2)
      audits[0].activeParticipant[0].userID.should.be.equal('OpenHIM')
      audits[0].activeParticipant[1].userID.should.be.equal('root@jembi.org')
    })
  })
)
