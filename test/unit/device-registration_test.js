/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-iotagent-lib
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
'use strict';

var iotAgentLib = require('../../'),
    utils = require('../tools/utils'),
    should = require('should'),
    logger = require('fiware-node-logger'),
    nock = require('nock'),
    async = require('async'),
    contextBrokerMock,
    iotAgentConfig = {
        contextBroker: {
            host: '10.11.128.16',
            port: '1026'
        },
        server: {
            port: 4041
        },
        types: {
            'Light': {
                commands: [],
                lazy: [
                    {
                        name: 'temperature',
                        type: 'centigrades'
                    }
                ],
                active: [
                    {
                        name: 'pressure',
                        type: 'Hgmm'
                    }
                ],
                service: 'smartGondor',
                subservice: 'gardens'
            },
            'Termometer': {
                commands: [],
                lazy: [
                    {
                        name: 'temp',
                        type: 'kelvin'
                    }
                ],
                active: [
                ],
                service: 'smartGondor',
                subservice: 'gardens'
            }
        },
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    },
    device1 = {
        id: 'light1',
        type: 'Light'
    },
    device2 = {
        id: 'term2',
        type: 'Termometer'
    };

describe('IoT Agent Device Registration', function() {
    beforeEach(function() {
        logger.setLevel('FATAL');
    });

    afterEach(function(done) {
        iotAgentLib.deactivate(done);
    });

    describe('When a new device is connected to the IoT Agent', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                    utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent1.json'))
                .reply(200,
                    utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Success.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                done();
            });
        });

        it('should register as ContextProvider of its lazy attributes', function(done) {
                iotAgentLib.register(device1.id, device1.type, null, null, null, null, null, function(error) {
                    should.not.exist(error);
                    contextBrokerMock.done();
                    done();
                });
        });
    });

    describe('When a device is removed from the IoT Agent', function() {
        beforeEach(function(done) {
            var expectedPayload3 = utils
                    .readExampleFile('./test/unit/contextAvailabilityRequests/unregisterDevice1.json');

            nock.cleanAll();
            contextBrokerMock = nock('http://10.11.128.16:1026')
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice1Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice2Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext', expectedPayload3)
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/unregisterDevice1Success.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                async.series([
                    async.apply(iotAgentLib.register, device1.id, device1.type, null, null, null, null, null),
                    async.apply(iotAgentLib.register, device2.id, device2.type, null, null, null, null, null)
                ], done);
            });
        });

        it('should update the devices information in the Context Broker', function(done) {
            iotAgentLib.unregister(device1.id, device1.type, function(error) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When the Context Broker returns an error while registering a device', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                    utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent1.json'))
                .reply(500,
                    utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Failed.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                done();
            });
        });

        it('should not register the device in the internal registry');
        it('should return a REGISTRATION_ERROR error to the caller', function(done) {
            iotAgentLib.register(device1.id, device1.type, null, null, null, null, null, function(error) {
                should.exist(error);
                should.exist(error.name);
                error.name.should.equal('REGISTRATION_ERROR');

                done();
            });
        });
    });

    describe('When the Context Broker returns an error while unregistering a device', function() {
        beforeEach(function(done) {
            var expectedPayload3 = utils
                .readExampleFile('./test/unit/contextAvailabilityRequests/unregisterDevice1.json');

            nock.cleanAll();
            contextBrokerMock = nock('http://10.11.128.16:1026')
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice1Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice2Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext', expectedPayload3)
                .reply(500, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/unregisterDevice1Failed.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                async.series([
                    async.apply(iotAgentLib.register, device1.id, device1.type, null, null, null, null, null),
                    async.apply(iotAgentLib.register, device2.id, device2.type, null, null, null, null, null)
                ], done);
            });
        });

        it('should not remove the device from the internal registry');
        it('should return a UNREGISTRATION_ERROR error to the caller', function(done) {
            iotAgentLib.unregister(device1.id, device1.type, function(error) {
                should.exist(error);
                should.exist(error.name);
                error.name.should.equal('UNREGISTRATION_ERROR');

                done();
            });
        });
    });

    describe('When a device is registered in the Context Broker and its type is not configured', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent1.json'))
                .reply(500,
                utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Failed.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                done();
            });
        });

        it('should raise a TYPE_NOT_FOUND error', function(done) {
            iotAgentLib.register(device1.id, 'UnexistentType', null, null, null, null, null, function(error) {
                should.exist(error);
                should.exist(error.name);
                error.name.should.equal('TYPE_NOT_FOUND');

                done();
            });
        });
    });
});
