import { existsSync } from 'fs';

import { setFailed } from '@actions/core';

import {
    getActionOptions, getBooleanInput, getPathsToUpdate
} from './util';
import { Updater } from './update';

function main(): void {
    const options = getActionOptions();

    const pathsToUpdate = getPathsToUpdate();
    const isRemovingAllowed = getBooleanInput('allow-removing');

    for (const path of pathsToUpdate) {
        const isLocalFileExists = existsSync(path);
        if (!isLocalFileExists && !isRemovingAllowed) {
            setFailed(`Removing remote ${path} is not allowed`);
            return;
        }
    }

    const updater = new Updater(options);
    updater.updateFiles(pathsToUpdate).then((commitSha) => {
        if (commitSha === null) {
            console.log('No files to update');
            return;
        }

        const shortSha = commitSha.slice(0, 7);
        console.log(`Pushed ${shortSha} to ${options.branch}`);
    }).catch((err) => {
        setFailed(err.message);
    });
}

main();
