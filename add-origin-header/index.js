// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

function handler(event) {
    var request = event.request;
    var headers = request.headers;
    var host = request.headers.host.value;
   
   // If origin header is missing, set it equal to the host header.
   if (!headers.origin)
       headers.origin = {value:`https://${host}`};
       
   return request;
}