#!/bin/bash
export JAVA_HOME="/c/Users/lenovo/.antigravity-ide/extensions/redhat.java-1.56.0-win32-x64/jre/21.0.12.1-win32-x86_64"
export PATH="$JAVA_HOME/bin:/c/maven/bin:$PATH"
cd "/d/E/3rd Sem capston project/SmartEats/backend"
mvn package -DskipTests
