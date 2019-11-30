/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
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
 * If not, see http://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 *
 * Modified by: Federico M. Facca - Martel Innovate
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

/* eslint-disable no-unused-vars */

const iotAgentLib = require('../../../lib/fiware-iotagent-lib');
const request = require('request');
const nock = require('nock');
const utils = require('../../tools/utils');
const groupRegistryMemory = require('../../../lib/services/groups/groupRegistryMemory');
const should = require('should');
const iotAgentConfig = {
    logLevel: 'FATAL',
    contextBroker: {
        url: 'https://192.168.1.1:1026'
    },
    server: {
        port: 4041
    },
    types: {
        Light: {
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
        Termometer: {
            commands: [],
            lazy: [
                {
                    name: 'temp',
                    type: 'kelvin'
                }
            ],
            active: [],
            service: 'smartGondor',
            subservice: 'gardens'
        }
    },
    service: 'smartGondor',
    subservice: 'gardens',
    providerUrl: 'http://smartGondor.com',
    deviceRegistrationDuration: 'P1M',
    iotManager: {
        url: 'https://mockediotam.com:9876',
        path: '/protocols',
        protocol: 'GENERIC_PROTOCOL',
        description: 'A generic protocol',
        agentPath: '/iot'
    },
    defaultResource: '/iot/d'
};
const groupCreation = {
    service: 'theService',
    subservice: 'theSubService',
    resource: '/deviceTest',
    apikey: '801230BJKL23Y9090DSFL123HJK09H324HV8732',
    type: 'SensorMachine',
    trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
    commands: [
        {
            name: 'wheel1',
            type: 'Wheel'
        }
    ],
    lazy: [
        {
            name: 'luminescence',
            type: 'Lumens'
        }
    ],
    attributes: [
        {
            name: 'status',
            type: 'Boolean'
        }
    ]
};
const device1 = {
    id: 'light1',
    type: 'Light',
    service: 'smartGondor',
    subservice: 'gardens'
};
let contextBrokerMock;
let iotamMock;

describe('HTTPS support tests IOTAM', function() {
    describe('When the IoT Agents is started with https "iotManager" config', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            iotamMock = nock('https://mockediotam.com:9876')
                .post(
                    '/protocols',
                    utils.readExampleFile('./test/unit/examples/iotamRequests/registrationWithGroupsWithoutCB.json')
                )
                .reply(200, utils.readExampleFile('./test/unit/examples/iotamResponses/registrationSuccess.json'));

            groupRegistryMemory.create(groupCreation, done);
        });

        afterEach(function(done) {
            nock.cleanAll();
            groupRegistryMemory.clear(function() {
                iotAgentLib.deactivate(done);
            });
        });

        it('should register without errors to the IoT Manager', function(done) {
            iotAgentLib.activate(iotAgentConfig, function(error) {
                should.not.exist(error);
                iotamMock.done();
                done();
            });
        });
    });
});

describe('HTTPS support tests', function() {
    describe('When subscription is sent to HTTPS context broker', function() {
        beforeEach(function(done) {
            const optionsProvision = {
                url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile(
                    './test/unit/examples/deviceProvisioningRequests/provisionMinimumDevice.json'
                ),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            iotAgentConfig.iotManager = {};

            nock.cleanAll();

            iotAgentLib.activate(iotAgentConfig, function() {
                contextBrokerMock = nock('https://192.168.1.1:1026')
                    .matchHeader('fiware-service', 'smartGondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v1/updateContext',
                        utils.readExampleFile(
                            './test/unit/examples/contextRequests/createMinimumProvisionedDevice.json'
                        )
                    )
                    .reply(
                        200,
                        utils.readExampleFile(
                            './test/unit/examples/contextResponses/createProvisionedDeviceSuccess.json'
                        )
                    );

                contextBrokerMock = nock('https://192.168.1.1:1026')
                    .matchHeader('fiware-service', 'smartGondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v1/subscribeContext',
                        utils.readExampleFile(
                            './test/unit/examples/subscriptionRequests/simpleSubscriptionRequest.json'
                        )
                    )
                    .reply(
                        200,
                        utils.readExampleFile(
                            './test/unit/examples/subscriptionResponses/simpleSubscriptionSuccess.json'
                        )
                    );

                iotAgentLib.clearAll(function() {
                    request(optionsProvision, function(error, result, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function(done) {
            nock.cleanAll();
            iotAgentLib.setNotificationHandler();
            iotAgentLib.clearAll(function() {
                iotAgentLib.deactivate(done);
            });
        });

        it('should send the appropriate request to the Context Broker', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    should.not.exist(error);

                    contextBrokerMock.done();

                    done();
                });
            });
        });
    });

    describe('When a new device is connected to the IoT Agent', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            iotAgentConfig.iotManager = {};

            contextBrokerMock = nock('https://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post(
                    '/NGSI9/registerContext',
                    utils.readExampleFile('./test/unit/examples/contextAvailabilityRequests/registerIoTAgent1.json')
                )
                .reply(
                    200,
                    utils.readExampleFile(
                        './test/unit/examples/contextAvailabilityResponses/registerIoTAgent1Success.json'
                    )
                );

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/v1/updateContext')
                .reply(
                    200,
                    utils.readExampleFile('./test/unit/examples/contextResponses/createProvisionedDeviceSuccess.json')
                );

            iotAgentLib.activate(iotAgentConfig, function(error) {
                iotAgentLib.clearAll(done);
            });
        });

        it('should register as ContextProvider using HTTPS', function(done) {
            iotAgentLib.register(device1, function(error) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });

        afterEach(function(done) {
            nock.cleanAll();
            iotAgentLib.clearAll(function() {
                // We need to remove the registrationId so that the library does not consider next operatios as updates.
                delete device1.registrationId;
                iotAgentLib.deactivate(done);
            });
        });
    });
});
