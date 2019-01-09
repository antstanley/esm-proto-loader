/**
 * @license
 * Copyright 2018 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import * as Protobuf from 'protobufjs';
import { accessSync, constants } from 'fs';
import { isAbsolute, join } from 'path';
import camelCase from 'lodash.camelcase';
function joinName(baseName, name) {
    if (baseName === '') {
        return name;
    }
    else {
        return baseName + '.' + name;
    }
}
function getAllServices(obj, parentName) {
    const objName = joinName(parentName, obj.name);
    if (obj.hasOwnProperty('methods')) {
        return [[objName, obj]];
    }
    else {
        return obj.nestedArray.map((child) => {
            if (child.hasOwnProperty('nested')) {
                return getAllServices(child, objName);
            }
            else {
                return [];
            }
        }).reduce((accumulator, currentValue) => accumulator.concat(currentValue), []);
    }
}
function createDeserializer(cls, options) {
    return function deserialize(argBuf) {
        return cls.toObject(cls.decode(argBuf), options);
    };
}
function createSerializer(cls) {
    return function serialize(arg) {
        const message = cls.fromObject(arg);
        return cls.encode(message).finish();
    };
}
function createMethodDefinition(method, serviceName, options) {
    return {
        path: '/' + serviceName + '/' + method.name,
        requestStream: !!method.requestStream,
        responseStream: !!method.responseStream,
        requestSerialize: createSerializer(method.resolvedRequestType),
        requestDeserialize: createDeserializer(method.resolvedRequestType, options),
        responseSerialize: createSerializer(method.resolvedResponseType),
        responseDeserialize: createDeserializer(method.resolvedResponseType, options),
        // TODO(murgatroid99): Find a better way to handle this
        originalName: camelCase(method.name)
    };
}
function createServiceDefinition(service, name, options) {
    const def = {};
    for (const method of service.methodsArray) {
        def[method.name] = createMethodDefinition(method, name, options);
    }
    return def;
}
function createPackageDefinition(root, options) {
    const def = {};
    for (const [name, service] of getAllServices(root, '')) {
        def[name] = createServiceDefinition(service, name, options);
    }
    return def;
}
function addIncludePathResolver(root, includePaths) {
    const originalResolvePath = root.resolvePath;
    root.resolvePath = (origin, target) => {
        if (isAbsolute(target)) {
            return target;
        }
        for (const directory of includePaths) {
            const fullPath = join(directory, target);
            try {
                accessSync(fullPath, constants.R_OK);
                return fullPath;
            }
            catch (err) {
                continue;
            }
        }
        return originalResolvePath(origin, target);
    };
}
/**
 * Load a .proto file with the specified options.
 * @param filename The file path to load. Can be an absolute path or relative to
 *     an include path.
 * @param options.keepCase Preserve field names. The default is to change them
 *     to camel case.
 * @param options.longs The type that should be used to represent `long` values.
 *     Valid options are `Number` and `String`. Defaults to a `Long` object type
 *     from a library.
 * @param options.enums The type that should be used to represent `enum` values.
 *     The only valid option is `String`. Defaults to the numeric value.
 * @param options.bytes The type that should be used to represent `bytes`
 *     values. Valid options are `Array` and `String`. The default is to use
 *     `Buffer`.
 * @param options.defaults Set default values on output objects. Defaults to
 *     `false`.
 * @param options.arrays Set empty arrays for missing array values even if
 *     `defaults` is `false`. Defaults to `false`.
 * @param options.objects Set empty objects for missing object values even if
 *     `defaults` is `false`. Defaults to `false`.
 * @param options.oneofs Set virtual oneof properties to the present field's
 *     name
 * @param options.includeDirs Paths to search for imported `.proto` files.
 */
export function load(filename, options) {
    const root = new Protobuf.Root();
    options = options || {};
    if (!!options.includeDirs) {
        if (!(options.includeDirs instanceof Array)) {
            return Promise.reject(new Error('The includeDirs option must be an array'));
        }
        addIncludePathResolver(root, options.includeDirs);
    }
    return root.load(filename, options).then((loadedRoot) => {
        loadedRoot.resolveAll();
        return createPackageDefinition(root, options);
    });
}
export function loadSync(filename, options) {
    const root = new Protobuf.Root();
    options = options || {};
    if (!!options.includeDirs) {
        if (!(options.includeDirs instanceof Array)) {
            throw new Error('The include option must be an array');
        }
        addIncludePathResolver(root, options.includeDirs);
    }
    const loadedRoot = root.loadSync(filename, options);
    loadedRoot.resolveAll();
    return createPackageDefinition(root, options);
}
//# sourceMappingURL=index.js.map