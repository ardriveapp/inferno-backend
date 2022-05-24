#!/bin/bash

EXITCODE=1 && while [ $EXITCODE -eq 1 ]; do
    yarn node ./lib/index.js aggregate;
    EXITCODE=$?;
    echo "Exit code: $EXITCODE";
done

exit $EXITCODE
