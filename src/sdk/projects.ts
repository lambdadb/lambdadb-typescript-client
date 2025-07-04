/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */

import { ClientSDK } from "../lib/sdks.js";
import { Collections } from "./collections.js";

export class Projects extends ClientSDK {
  private _collections?: Collections;
  get collections(): Collections {
    return (this._collections ??= new Collections(this._options));
  }
}
