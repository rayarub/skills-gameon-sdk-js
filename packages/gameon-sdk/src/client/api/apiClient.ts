/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
*/

import { ApiClientRequest, ApiClientResponse, ApiConfiguration } from '../http/apiClient';

export abstract class ApiClient {
    private static isCodeSuccessful( responseCode: number ): boolean {
        // tslint:disable-next-line:no-magic-numbers
        return responseCode >= 200 && responseCode < 300;
    }

    private static buildUrl(
        endpoint: string,
        path: string,
        queryParameters: Map<string, string>,
        pathParameters: Map<string, string>
    ): string {
        const processedEndpoint: string = endpoint.endsWith('/') ? endpoint.substr(0, endpoint.length - 1) : endpoint;
        const pathWithParams: string = this.interpolateParams(path, pathParameters);
        const isConstantQueryPresent: boolean = pathWithParams.includes('?');
        const queryString: string = this.buildQueryString(queryParameters, isConstantQueryPresent);

        return processedEndpoint + pathWithParams + queryString;
    }

    private static interpolateParams(path: string, params: Map<string, string>): string {
        if (!params) {
            return path;
        }

        let result: string = path;

        params.forEach((paramValue: string, paramName: string) => {
            result = result.replace('{' + paramName + '}', encodeURIComponent(paramValue));
        });

        return result;
    }

    private static buildQueryString(params: Map<string, string>, isQueryStart: boolean): string {
        if (!params) {
            return '';
        }

        const sb: string[] = [];

        if (isQueryStart) {
            sb.push('&');
        } else {
            sb.push('?');
        }

        params.forEach((paramValue: string, paramName: string) => {
            sb.push(encodeURIComponent(paramName));
            sb.push('=');
            sb.push(encodeURIComponent(paramValue));
            sb.push('&');
        });
        sb.pop();

        return sb.join('');
    }

    /**
     * ApiConfiguration instance to provide dependencies for this service client
     */
    protected apiConfiguration: ApiConfiguration;

    /**
     * Creates new instance of the ApiClient
     * @param {ApiConfiguration} apiConfiguration configuration parameter to provide dependencies to service client instance
     */
    protected constructor(apiConfiguration: ApiConfiguration) {
        this.apiConfiguration = apiConfiguration;
    }

    /**
     * Invocation wrapper to implement service operations in generated classes
     * @param method HTTP method, such as 'POST', 'GET', 'DELETE', etc.
     * @param endpoint base API url
     * @param path the path pattern with possible placeholders for path parameters in form {paramName}
     * @param pathParams path parameters collection
     * @param queryParams query parameters collection
     * @param headerParams headers collection
     * @param bodyParam if body parameter is present it is provided here, otherwise null or undefined
     * @param errors maps recognized status codes to messages
     */
    protected async invoke(
        method: string,
        endpoint: string,
        path: string,
        pathParams: Map<string, string>,
        queryParams: Map<string, string>,
        headerParams: Array<{ key: string, value: string }>,
        bodyParam: any, errors: Map<number, string>
    ): Promise<any> {
        const request: ApiClientRequest = {
            url : ApiClient.buildUrl(endpoint, path, queryParams, pathParams),
            method,
            headers : headerParams
        };
        if (bodyParam !== null) {
            request.body = JSON.stringify(bodyParam);
        }

        const apiClient = this.apiConfiguration.apiClient;
        let response: ApiClientResponse;
        try {
            response = await apiClient.invoke(request);
        } catch (err) {
            err.message = `Call to service failed: ${err.message}`;

            throw err;
        }

        let body;

        try {
            body = response.body ? JSON.parse(response.body) : undefined;
        } catch (err) {
            throw new SyntaxError(`Failed trying to parse the response body: ${response.body}`);
        }

        if (ApiClient.isCodeSuccessful(response.statusCode)) {
            return body;
        }

        const err = new Error('Unknown error');
        err.name = 'ServiceError';
        err['statusCode'] = response.statusCode; // tslint:disable-line:no-string-literal
        err['response'] = body; // tslint:disable-line:no-string-literal
        if (errors && errors.has(response.statusCode)) {
            err.message = JSON.stringify(response.body);
        }

        throw err;
    }
}
